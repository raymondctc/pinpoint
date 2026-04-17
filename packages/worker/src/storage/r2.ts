export async function storeScreenshot(bucket: R2Bucket, id: string, body: ArrayBuffer | Uint8Array): Promise<R2Object> {
  return bucket.put(`feedback/${id}/screenshot.png`, body, {
    httpMetadata: { contentType: 'image/png' },
  });
}

export async function storeDOMSnapshot(bucket: R2Bucket, id: string, data: object): Promise<R2Object> {
  return bucket.put(`feedback/${id}/dom-snapshot.json`, JSON.stringify(data), {
    httpMetadata: { contentType: 'application/json' },
  });
}

export async function getScreenshot(bucket: R2Bucket, id: string): Promise<R2ObjectBody | null> {
  return bucket.get(`feedback/${id}/screenshot.png`);
}

export async function getDOMSnapshot(bucket: R2Bucket, id: string): Promise<R2ObjectBody | null> {
  return bucket.get(`feedback/${id}/dom-snapshot.json`);
}