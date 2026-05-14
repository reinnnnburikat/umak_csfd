/**
 * Converts a stored file URL into a serve-file API URL that properly
 * serves the file with correct Content-Type headers.
 *
 * For data URLs (e.g., "data:image/png;base64,..."), returns them directly
 * since browsers can render them inline in <img> tags.
 * NEVER use data URLs with window.open() — use openFileUrl() instead.
 *
 * For regular file paths (e.g., "/uploads/file.pdf"), routes through the
 * serve-file API to get proper Content-Type headers.
 *
 * @param fileUrl - The stored file URL (e.g., "/uploads/file.pdf" or a data: URL)
 * @returns The serve-file API URL, the data URL directly, or null
 */
export function getServeFileUrl(fileUrl: string | null | undefined): string | null {
  if (!fileUrl) return null;

  // Data URLs can be megabytes long — never put them in a query parameter.
  // Browsers handle data: URLs natively in <img src>.
  // For opening/downloading, use openFileUrl() instead.
  if (fileUrl.startsWith('data:')) {
    return fileUrl;
  }

  return `/api/serve-file?file=${encodeURIComponent(fileUrl)}`;
}

/**
 * Converts a data URL to a blob URL. Safe for use as <iframe src>, <img src>,
 * window.open(), etc. The caller is responsible for revoking the blob URL
 * when it's no longer needed via URL.revokeObjectURL().
 *
 * For non-data URLs (filesystem paths), returns the serve-file API URL.
 *
 * @param fileUrl - The stored file URL (data: URL or filesystem path)
 * @returns A blob URL (for data URLs) or serve-file URL (for paths), or null
 */
export function dataUrlToBlobUrl(dataUrl: string): string | null {
  try {
    const commaIndex = dataUrl.indexOf(',');
    if (commaIndex === -1) return null;
    const metaPart = dataUrl.substring(0, commaIndex);
    const base64Data = dataUrl.substring(commaIndex + 1);
    const mimeMatch = metaPart.match(/^data:([^;]+)/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';

    const byteString = atob(base64Data);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: mimeType });
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

/**
 * Gets a URL suitable for use as <iframe src> or <embed src>.
 * Data URLs are converted to blob URLs (fragments like #toolbar=1 don't work with data URLs).
 * Filesystem paths are routed through the serve-file API (fragments work fine).
 *
 * @param fileUrl - The stored file URL (data: URL or filesystem path)
 * @param fragment - Optional URL fragment to append (e.g., "#toolbar=1&navpanes=0")
 * @returns A URL string suitable for iframe/embed, or null
 */
export function getIframeSrcUrl(fileUrl: string | null | undefined, fragment?: string): string | null {
  if (!fileUrl) return null;

  if (fileUrl.startsWith('data:')) {
    // Data URLs don't support fragments — convert to blob URL
    const blobUrl = dataUrlToBlobUrl(fileUrl);
    return blobUrl ? (fragment ? `${blobUrl}${fragment}` : blobUrl) : null;
  }

  const serveUrl = getServeFileUrl(fileUrl) || fileUrl;
  return fragment ? `${serveUrl}${fragment}` : serveUrl;
}

/**
 * Determines the type of a stored file URL based on MIME type or file extension.
 * Works with both data URLs and filesystem paths.
 *
 * @param fileUrl - The stored file URL (data: URL or filesystem path)
 * @returns 'image' | 'pdf' | 'word' | 'unknown'
 */
export function getFileType(fileUrl: string): 'image' | 'pdf' | 'word' | 'unknown' {
  // Check MIME type from data URLs (e.g., "data:image/png;base64,...")
  if (fileUrl.startsWith('data:')) {
    const mimeMatch = fileUrl.match(/^data:([^;]+);/);
    if (mimeMatch) {
      const mime = mimeMatch[1];
      if (mime.startsWith('image/')) return 'image';
      if (mime === 'application/pdf') return 'pdf';
      if (mime === 'application/msword' || mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'word';
    }
    return 'unknown';
  }

  // Extract the actual file path from serve-file API URLs
  let filePath = fileUrl;
  if (fileUrl.startsWith('/api/serve-file')) {
    try {
      const urlObj = new URL(fileUrl, 'http://localhost');
      const fileParam = urlObj.searchParams.get('file');
      if (fileParam) filePath = fileParam;
    } catch {
      // If URL parsing fails, use original URL
    }
  }

  // Check file extension on the extracted path
  if (/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(filePath)) return 'image';
  if (/\.pdf$/i.test(filePath)) return 'pdf';
  if (/\.(doc|docx)$/i.test(filePath)) return 'word';
  return 'unknown';
}

/**
 * Opens a file URL in a new tab or triggers download.
 * Handles data URLs by creating a blob URL first (avoids URI_TOO_LONG).
 * Handles regular URLs by routing through serve-file API.
 *
 * @param fileUrl - The stored file URL (data: URL or filesystem path)
 * @param options - Optional: { download: true } to trigger download instead of opening
 */
export function openFileUrl(fileUrl: string | null | undefined, options?: { download?: boolean; fileName?: string }): void {
  if (!fileUrl) return;

  if (fileUrl.startsWith('data:')) {
    // Convert data URL to blob URL to avoid URI_TOO_LONG
    const blobUrl = dataUrlToBlobUrl(fileUrl);
    if (!blobUrl) return;

    if (options?.download) {
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = options.fileName || 'document';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } else {
      window.open(blobUrl, '_blank');
      // Revoke after a delay so the browser can load it
      setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
    }
  } else {
    const serveUrl = getServeFileUrl(fileUrl) || fileUrl;
    if (options?.download) {
      const a = document.createElement('a');
      a.href = serveUrl;
      a.download = options.fileName || '';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      window.open(serveUrl, '_blank');
    }
  }
}
