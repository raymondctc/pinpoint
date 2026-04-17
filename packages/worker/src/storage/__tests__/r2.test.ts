import { describe, it, expect, vi } from 'vitest';
import { storeScreenshot, storeDOMSnapshot, getScreenshot, getDOMSnapshot } from '../r2.js';

function createMockBucket(): R2Bucket {
  const store = new Map<string, { body: ArrayBuffer | string; metadata?: Record<string, string> }>();
  return {
    put: vi.fn(async (key: string, value: ArrayBuffer | string, options?: { httpMetadata?: { contentType?: string } }) => {
      store.set(key, { body: typeof value === 'string' ? value : value, metadata: options?.httpMetadata as any });
      return { key } as R2Object;
    }),
    get: vi.fn(async (key: string) => {
      const entry = store.get(key);
      if (!entry) return null;
      return { key, body: entry.body, httpMetadata: entry.metadata } as unknown as R2ObjectBody;
    }),
    head: vi.fn(async () => null),
    delete: vi.fn(async () => undefined),
    list: vi.fn(async () => ({ objects: [], delimitedPrefixes: [] }) as unknown as R2Objects),
  } as unknown as R2Bucket;
}

describe('storeScreenshot', () => {
  it('puts with correct key pattern and contentType image/png', async () => {
    const bucket = createMockBucket();
    const id = 'abc-123';
    const body = new ArrayBuffer(8);

    await storeScreenshot(bucket, id, body);

    expect(bucket.put).toHaveBeenCalledWith(
      `feedback/${id}/screenshot.png`,
      body,
      { httpMetadata: { contentType: 'image/png' } },
    );
  });
});

describe('storeDOMSnapshot', () => {
  it('puts with correct key pattern and contentType application/json', async () => {
    const bucket = createMockBucket();
    const id = 'abc-123';
    const data = { tagName: 'div', children: [] };

    await storeDOMSnapshot(bucket, id, data);

    expect(bucket.put).toHaveBeenCalledWith(
      `feedback/${id}/dom-snapshot.json`,
      JSON.stringify(data),
      { httpMetadata: { contentType: 'application/json' } },
    );
  });
});

describe('getScreenshot', () => {
  it('gets with correct key', async () => {
    const bucket = createMockBucket();
    const id = 'abc-123';
    const body = new ArrayBuffer(8);

    await storeScreenshot(bucket, id, body);
    const result = await getScreenshot(bucket, id);

    expect(bucket.get).toHaveBeenCalledWith(`feedback/${id}/screenshot.png`);
    expect(result).not.toBeNull();
    expect(result!.key).toBe(`feedback/${id}/screenshot.png`);
  });

  it('returns null when key does not exist', async () => {
    const bucket = createMockBucket();
    const result = await getScreenshot(bucket, 'nonexistent');
    expect(result).toBeNull();
  });
});

describe('getDOMSnapshot', () => {
  it('gets with correct key', async () => {
    const bucket = createMockBucket();
    const id = 'abc-123';
    const data = { tagName: 'div', children: [] };

    await storeDOMSnapshot(bucket, id, data);
    const result = await getDOMSnapshot(bucket, id);

    expect(bucket.get).toHaveBeenCalledWith(`feedback/${id}/dom-snapshot.json`);
    expect(result).not.toBeNull();
    expect(result!.key).toBe(`feedback/${id}/dom-snapshot.json`);
  });

  it('returns null when key does not exist', async () => {
    const bucket = createMockBucket();
    const result = await getDOMSnapshot(bucket, 'nonexistent');
    expect(result).toBeNull();
  });
});