import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchFeedbackList,
  fetchFeedbackItem,
  updateFeedbackStatus,
  deleteFeedback,
  fetchProjects,
  createProject,
  getScreenshotUrl,
  getDOMSnapshotUrl,
} from '../client.js';

// Mock global fetch
const mockFetch = vi.spyOn(globalThis, 'fetch');

beforeEach(() => {
  vi.clearAllMocks();
});

function mockResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('API client', () => {
  describe('fetchFeedbackList', () => {
    it('fetches feedback list without params', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ items: [], cursor: null }));
      const result = await fetchFeedbackList();
      expect(result).toEqual({ items: [], cursor: null });
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/feedback',
        expect.objectContaining({ headers: expect.any(Object) }),
      );
    });

    it('passes query parameters', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ items: [], cursor: null }));
      await fetchFeedbackList({ status: 'open', limit: 10 });
      const url = (mockFetch.mock.calls[0] as string[])[0];
      expect(url).toContain('status=open');
      expect(url).toContain('limit=10');
    });

    it('throws on error response', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ error: 'Not found' }, 404));
      await expect(fetchFeedbackItem('bad-id')).rejects.toThrow('Not found');
    });
  });

  describe('fetchFeedbackItem', () => {
    it('fetches a single feedback item', async () => {
      const item = { id: 'fb1', status: 'open', comment: 'Test' };
      mockFetch.mockResolvedValueOnce(mockResponse(item));
      const result = await fetchFeedbackItem('fb1');
      expect(result).toEqual(item);
    });
  });

  describe('updateFeedbackStatus', () => {
    it('sends PATCH request', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ id: 'fb1', status: 'resolved' }));
      const result = await updateFeedbackStatus('fb1', 'resolved');
      expect(result).toEqual({ id: 'fb1', status: 'resolved' });
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/feedback/fb1/status',
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
  });

  describe('deleteFeedback', () => {
    it('sends DELETE request', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ id: 'fb1', status: 'deleted' }));
      const result = await deleteFeedback('fb1');
      expect(result).toEqual({ id: 'fb1', status: 'deleted' });
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/feedback/fb1',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  describe('fetchProjects', () => {
    it('fetches project list', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ items: [] }));
      const result = await fetchProjects();
      expect(result).toEqual({ items: [] });
    });
  });

  describe('createProject', () => {
    it('sends POST request', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ id: 'p1', name: 'Test', slug: 'test' }, 201));
      const result = await createProject('Test', 'test');
      expect(result).toEqual({ id: 'p1', name: 'Test', slug: 'test' });
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/projects',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  describe('URL helpers', () => {
    it('getScreenshotUrl returns correct path', () => {
      expect(getScreenshotUrl('fb1')).toBe('/api/v1/feedback/fb1/screenshot');
    });

    it('getDOMSnapshotUrl returns correct path', () => {
      expect(getDOMSnapshotUrl('fb1')).toBe('/api/v1/feedback/fb1/dom-snapshot');
    });
  });
});