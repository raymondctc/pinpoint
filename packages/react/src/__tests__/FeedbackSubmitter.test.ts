import { describe, it, expect, vi, beforeEach } from 'vitest';
import { submitFeedback } from '../FeedbackSubmitter.js';
import type { FeedbackMetadata, DOMSnapshotNode } from '@pinpoint/shared';

describe('submitFeedback', () => {
  const mockEndpoint = 'https://feedback.test.workers.dev/api/v1/feedback';
  const mockMetadata: FeedbackMetadata = {
    projectId: 'test-project',
    comment: 'Button not working',
    category: 'bug',
    selector: '#main .cta-btn',
    url: 'https://example.com/page',
    viewportWidth: 1920,
    viewportHeight: 1080,
    userAgent: 'Mozilla/5.0',
    captureMethod: 'html2canvas',
  };
  const mockSnapshot: DOMSnapshotNode = {
    tagName: 'button',
    selector: '.cta-btn',
    textContent: 'Submit',
    attributes: {},
    computedStyles: {},
    boundingRect: { x: 100, y: 200, width: 150, height: 40 },
    children: [],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sends multipart POST with metadata, screenshot, and dom-snapshot', async () => {
    const mockBlob = new Blob(['fake-png'], { type: 'image/png' });

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'test-id' }), { status: 201 }),
    );

    const result = await submitFeedback({
      endpoint: mockEndpoint,
      metadata: mockMetadata,
      screenshot: mockBlob,
      domSnapshot: mockSnapshot,
    });

    expect(result.success).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe(mockEndpoint);
    expect(options!.method).toBe('POST');

    const body = options!.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.has('metadata')).toBe(true);
    expect(body.has('screenshot')).toBe(true);
    expect(body.has('dom-snapshot')).toBe(true);
  });

  it('returns error when fetch fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
      new Error('Network error'),
    );

    const result = await submitFeedback({
      endpoint: mockEndpoint,
      metadata: mockMetadata,
      screenshot: new Blob([''], { type: 'image/png' }),
      domSnapshot: mockSnapshot,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Network error');
  });

  it('returns error when server returns non-201', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Bad Request' }), { status: 400 }),
    );

    const result = await submitFeedback({
      endpoint: mockEndpoint,
      metadata: mockMetadata,
      screenshot: new Blob([''], { type: 'image/png' }),
      domSnapshot: mockSnapshot,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('400');
  });
});