import path from 'path';

const MAX_DOWNLOAD_BYTES = 50 * 1024 * 1024;

export async function downloadRemoteAsset(source) {
  if (
    !source ||
    typeof source.url !== 'string' ||
    typeof source.filename !== 'string'
  ) {
    throw new Error('Asset must contain a URL and filename');
  }

  const safeFilename = path
    .basename(source.filename)
    .replace(/[^a-z0-9._-]/gi, '_');

  const response = await fetch(source.url);
  if (!response.ok || !response.body) {
    throw new Error(
      `Unable to download source asset (status ${response.status})`
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > MAX_DOWNLOAD_BYTES) {
    throw new Error('Source asset exceeds the 50 MB limit');
  }
  
  return { buffer, filename: safeFilename };
}
