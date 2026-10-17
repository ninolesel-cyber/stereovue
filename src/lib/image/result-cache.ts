let cached: Blob | null = null;

export function cacheResultBlob(blob: Blob | null) {
  cached = blob;
}

export function getCachedResultBlob() {
  return cached;
}
