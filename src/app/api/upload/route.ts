import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, unlink, stat } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Maximum file size: 10 MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Allowed file extensions (must match the client-side ALLOWED_EXTENSIONS)
const ALLOWED_EXTENSIONS = [
  '.pdf', '.doc', '.docx',
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg',
  '.txt', '.rtf',
];

// Allowed MIME types for additional server-side validation
const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  '.pdf': ['application/pdf'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.gif': ['image/gif'],
  '.webp': ['image/webp'],
  '.bmp': ['image/bmp'],
  '.svg': ['image/svg+xml'],
  '.txt': ['text/plain'],
  '.rtf': ['application/rtf', 'text/rtf'],
};

// Upload directory relative to the project root
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

/**
 * POST /api/upload
 *
 * Accepts multipart/form-data with a `file` field.
 * Saves the file to public/uploads/ with a unique filename.
 * Returns { url: "/uploads/filename.ext" } on success.
 */
export async function POST(request: NextRequest) {
  try {
    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'No file provided. Use FormData with a "file" field.' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds the ${MAX_FILE_SIZE / (1024 * 1024)}MB limit.` },
        { status: 400 }
      );
    }

    // Validate file size is not zero
    if (file.size === 0) {
      return NextResponse.json(
        { error: 'File is empty.' },
        { status: 400 }
      );
    }

    // Extract and validate file extension
    const originalName = file.name || 'unnamed';
    const ext = ('.' + originalName.split('.').pop()?.toLowerCase()) as string;

    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: `File type "${ext}" is not allowed. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate MIME type against extension
    const allowedMimes = ALLOWED_MIME_TYPES[ext];
    if (allowedMimes && !allowedMimes.includes(file.type)) {
      // MIME mismatch — could be a spoofed extension. Reject.
      return NextResponse.json(
        { error: `File content does not match the "${ext}" extension. The file may be corrupted or renamed.` },
        { status: 400 }
      );
    }

    // Ensure upload directory exists
    await mkdir(UPLOAD_DIR, { recursive: true });

    // Generate a unique filename to prevent collisions
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(8).toString('hex');
    const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 60);
    const filename = `${timestamp}_${random}_${safeName}`;

    // Full path for the file on disk
    const filePath = path.join(UPLOAD_DIR, filename);

    // Convert the File/Blob to a Buffer and write to disk
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    // Return the public URL path (relative to public/)
    const url = `/uploads/${filename}`;

    return NextResponse.json({ url }, { status: 201 });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/upload
 *
 * Deletes a previously uploaded file.
 * Body: { "url": "/uploads/filename.ext" }
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "url" parameter in request body.' },
        { status: 400 }
      );
    }

    // Only allow deleting files from the uploads directory
    if (!url.startsWith('/uploads/')) {
      return NextResponse.json(
        { error: 'Can only delete files from the /uploads/ directory.' },
        { status: 403 }
      );
    }

    // Prevent directory traversal
    const cleanPath = url.replace(/^\/+/, '');
    if (cleanPath.includes('..')) {
      return NextResponse.json(
        { error: 'Invalid file path.' },
        { status: 400 }
      );
    }

    const filePath = path.join(process.cwd(), 'public', cleanPath);

    // Verify the resolved path is still within the public/uploads directory
    const resolvedPath = path.resolve(filePath);
    const resolvedUploadDir = path.resolve(UPLOAD_DIR);
    if (!resolvedPath.startsWith(resolvedUploadDir)) {
      return NextResponse.json(
        { error: 'Access denied: path traversal detected.' },
        { status: 403 }
      );
    }

    // Check if file exists before attempting to delete
    try {
      const fileStat = await stat(resolvedPath);
      if (!fileStat.isFile()) {
        return NextResponse.json(
          { error: 'Not a file.' },
          { status: 400 }
        );
      }
    } catch {
      // File doesn't exist — already deleted, return success (idempotent)
      return NextResponse.json({ success: true, message: 'File already deleted.' });
    }

    // Delete the file
    await unlink(resolvedPath);

    return NextResponse.json({ success: true, message: 'File deleted successfully.' });
  } catch (error) {
    console.error('Delete upload error:', error);
    return NextResponse.json(
      { error: 'Failed to delete file.' },
      { status: 500 }
    );
  }
}
