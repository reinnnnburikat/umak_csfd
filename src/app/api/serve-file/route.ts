import { NextRequest, NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

// MIME type map for common file extensions
const MIME_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
  '.rtf': 'application/rtf',
};

// Extensions that should trigger a download rather than inline display
const DOWNLOAD_EXTENSIONS = ['.doc', '.docx', '.rtf'];

/**
 * Serves uploaded files with proper Content-Type and Content-Disposition headers.
 * Supports both filesystem paths (/uploads/filename.pdf) and data URLs (data:mime;base64,...).
 *
 * GET: /api/serve-file?file=/uploads/filename.pdf
 * POST: { "file": "data:..." } — for data URLs too large for query parameters
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileParam = searchParams.get('file');

    if (!fileParam) {
      return NextResponse.json(
        { error: 'Missing required query parameter: file' },
        { status: 400 }
      );
    }

    // Reject data URLs in GET query parameters — they can be megabytes long
    // and would cause URI_TOO_LONG errors. Use POST with JSON body instead.
    if (fileParam.startsWith('data:')) {
      return NextResponse.json(
        { error: 'Data URLs are not allowed in GET query parameters (URI_TOO_LONG risk). Use POST with JSON body instead.' },
        { status: 400 }
      );
    }

    // Handle filesystem paths
    return serveFileFromDisk(fileParam);
  } catch (error) {
    console.error('serve-file error:', error);
    return NextResponse.json(
      { error: 'Failed to serve file' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/serve-file
 *
 * Accepts a JSON body with a "file" parameter. Useful for serving data URLs
 * that are too large to fit in a GET query parameter (avoids URI_TOO_LONG).
 *
 * Body: { "file": "data:image/png;base64,..." } or { "file": "/uploads/file.pdf" }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { file: fileParam } = body;

    if (!fileParam || typeof fileParam !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "file" parameter in request body' },
        { status: 400 }
      );
    }

    // Handle data URLs
    if (fileParam.startsWith('data:')) {
      return serveDataUrl(fileParam);
    }

    // Handle filesystem paths
    return serveFileFromDisk(fileParam);
  } catch (error) {
    console.error('serve-file POST error:', error);
    return NextResponse.json(
      { error: 'Failed to serve file' },
      { status: 500 }
    );
  }
}

/**
 * Serves a file stored as a base64 data URL.
 * Format: data:<mime-type>;base64,<base64-data>
 */
function serveDataUrl(dataUrl: string): NextResponse {
  try {
    // Parse the data URL
    const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      return NextResponse.json(
        { error: 'Invalid data URL format' },
        { status: 400 }
      );
    }

    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    // Determine if this should be inline or attachment based on MIME type
    const isInline = mimeType.startsWith('image/') || mimeType === 'application/pdf';
    const contentDisposition = isInline ? 'inline' : 'attachment';

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': contentDisposition,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to decode data URL' },
      { status: 500 }
    );
  }
}

/**
 * Serves a file from the public/uploads directory on disk.
 */
async function serveFileFromDisk(relativePath: string): Promise<NextResponse> {
  // Normalize the path: remove leading slash and prevent directory traversal
  let cleanPath = relativePath.replace(/^\/+/, '');

  // Security: prevent directory traversal attacks
  if (cleanPath.includes('..')) {
    return NextResponse.json(
      { error: 'Invalid file path' },
      { status: 400 }
    );
  }

  // Only allow serving files from allowed directories
  const allowedPrefixes = ['uploads/', 'certificates/', 'profiles/', 'logos/', 'images/'];
  const isAllowed = allowedPrefixes.some((prefix) => cleanPath.startsWith(prefix));
  if (!isAllowed) {
    return NextResponse.json(
      { error: 'Access denied: file path not in allowed directories' },
      { status: 403 }
    );
  }

  // Construct absolute file path
  const filePath = path.join(process.cwd(), 'public', cleanPath);

  // Verify the resolved path is still within the public directory
  const publicDir = path.join(process.cwd(), 'public');
  const resolvedPath = path.resolve(filePath);
  if (!resolvedPath.startsWith(path.resolve(publicDir))) {
    return NextResponse.json(
      { error: 'Access denied: path traversal detected' },
      { status: 403 }
    );
  }

  // Check if file exists
  let fileStat;
  try {
    fileStat = await stat(resolvedPath);
  } catch {
    return NextResponse.json(
      { error: 'File not found' },
      { status: 404 }
    );
  }

  if (!fileStat.isFile()) {
    return NextResponse.json(
      { error: 'Not a file' },
      { status: 400 }
    );
  }

  // Read the file
  const buffer = await readFile(resolvedPath);

  // Determine Content-Type from file extension
  const ext = path.extname(resolvedPath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  // Determine Content-Disposition
  const isInline = !DOWNLOAD_EXTENSIONS.includes(ext);
  const fileName = path.basename(resolvedPath);
  const contentDisposition = isInline
    ? 'inline'
    : `attachment; filename="${fileName}"`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': contentDisposition,
      'Content-Length': buffer.length.toString(),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
