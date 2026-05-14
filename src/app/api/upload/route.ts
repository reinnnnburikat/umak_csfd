import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Allowed file extensions (lowercase, without dot)
const ALLOWED_EXTENSIONS = new Set([
  'pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'txt', 'rtf',
]);

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// MIME type mapping for base64 data URLs
const EXT_MIME_MAP: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  txt: 'text/plain',
  rtf: 'application/rtf',
};

function getExtension(filename: string): string {
  return (filename.split('.').pop() || '').toLowerCase();
}

/**
 * POST /api/upload
 *
 * Accepts a FormData with a 'file' field, validates it, converts to
 * base64 data URL, and returns it. NO filesystem writes needed —
 * works on Vercel (read-only filesystem) and locally.
 *
 * Returns: { url: "data:mime/type;base64,...", name, size, type }
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'No file provided. Please include a "file" field in the form data.' },
        { status: 400 }
      );
    }

    const filename = file.name || 'unnamed';
    const ext = getExtension(filename);

    // Validate file extension
    if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { error: `File type ".${ext || 'unknown'}" is not allowed. Allowed types: ${Array.from(ALLOWED_EXTENSIONS).map(e => `.${e}`).join(', ')}` },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds the 10MB limit. Your file is ${(file.size / (1024 * 1024)).toFixed(1)}MB.` },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: 'Cannot upload an empty file.' },
        { status: 400 }
      );
    }

    // Convert file to base64 data URL (Vercel-compatible, no filesystem writes)
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = EXT_MIME_MAP[ext] || file.type || 'application/octet-stream';
    const base64 = buffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64}`;

    console.log(`[Upload] Success: ${filename} (${(file.size / 1024).toFixed(1)}KB)`);

    return NextResponse.json({
      url: dataUrl,
      name: filename,
      size: file.size,
      type: file.type,
    });
  } catch (error) {
    console.error('[/api/upload] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/upload
 *
 * Best-effort deletion. For base64 data URLs, this is a no-op since
 * data isn't stored on disk. Kept for backward compatibility.
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "url" parameter.' },
        { status: 400 }
      );
    }

    // If it's a data URL, nothing to delete
    if (url.startsWith('data:')) {
      return NextResponse.json({ success: true }, { status: 200 });
    }

    // If it's a filesystem path, try to delete it
    if (url.startsWith('/uploads/')) {
      try {
        const { unlink } = await import('fs/promises');
        const { resolve } = await import('path');
        const filePath = resolve(process.cwd(), 'public', url.replace(/^\/+/, ''));

        // Security: prevent directory traversal
        if (filePath.includes('..')) {
          return NextResponse.json({ error: 'Invalid path.' }, { status: 400 });
        }

        const uploadsDir = resolve(process.cwd(), 'public', 'uploads');
        if (filePath.startsWith(uploadsDir)) {
          await unlink(filePath);
        }
      } catch {
        // File may not exist — that's fine
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('[/api/upload] DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete file.' },
      { status: 500 }
    );
  }
}
