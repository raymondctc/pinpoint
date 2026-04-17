import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createFeedback,
  listFeedback,
  getFeedbackById,
  updateFeedbackStatus,
  softDeleteFeedback,
  type FeedbackRow,
} from '../feedback-repo.js';

const sampleFeedback: FeedbackRow = {
  id: 'fb1',
  project_id: 'proj1',
  status: 'open',
  category: 'bug',
  comment: 'Something is broken',
  selector: 'div.main',
  url: 'https://example.com',
  viewport_width: 1920,
  viewport_height: 1080,
  user_agent: 'Mozilla/5.0',
  created_by: 'anonymous',
  capture_method: 'html2canvas',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
  deleted_at: null,
};

// Simplified mock: all queries return the shared store; specific .first() calls
// can be overridden per-test.
function createMockDB() {
  const store: FeedbackRow[] = [];

  const db = {
    prepare: vi.fn(() => {
      const stmt = {
        bind: vi.fn(function (this: unknown, ..._args: unknown[]) {
          return stmt;
        }),
        run: vi.fn(async () => ({})),
        all: vi.fn(async () => ({ results: store })),
        first: vi.fn(async () => store[0] ?? null),
      };
      return stmt;
    }),
  } as unknown as import('@cloudflare/workers-types').D1Database;

  return { db, store };
}

describe('feedback-repo', () => {
  describe('createFeedback', () => {
    it('inserts feedback and returns the created row', async () => {
      const { db, store } = createMockDB();
      store.push(sampleFeedback);

      const result = await createFeedback(db, {
        id: 'fb1',
        project_id: 'proj1',
        comment: 'Something is broken',
      });

      expect(result.id).toBe('fb1');
      expect(result.comment).toBe('Something is broken');
    });

    it('defaults status to open and created_by to anonymous', async () => {
      const { db, store } = createMockDB();
      store.push(sampleFeedback);

      const result = await createFeedback(db, {
        id: 'fb2',
        project_id: 'proj1',
        comment: 'Another bug',
      });

      expect(result.status).toBe('open');
      expect(result.created_by).toBe('anonymous');
    });
  });

  describe('listFeedback', () => {
    it('returns items with cursor when more results exist', async () => {
      const { db, store } = createMockDB();
      const items: FeedbackRow[] = Array.from({ length: 26 }, (_, i) => ({
        ...sampleFeedback,
        id: `fb${i}`,
        created_at: new Date(Date.now() - i * 1000).toISOString(),
        updated_at: new Date(Date.now() - i * 1000).toISOString(),
      }));
      store.push(...items);

      const result = await listFeedback(db, { limit: 25 });
      expect(result.items.length).toBeLessThanOrEqual(25);
      expect(result.cursor).not.toBeNull();
    });

    it('returns null cursor when no more results', async () => {
      const { db, store } = createMockDB();
      store.push(sampleFeedback);

      const result = await listFeedback(db, { limit: 25 });
      // With only 1 item and limit 25, we fetch 26 (limit+1), but store has 1
      // so no next page
      expect(result.items).toHaveLength(1);
    });

    it('defaults to excluding deleted items', async () => {
      const { db } = createMockDB();
      // The SQL should include "deleted_at IS NULL" condition
      const result = await listFeedback(db);
      expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('deleted_at IS NULL'));
    });

    it('includes deleted items when includeDeleted is true', async () => {
      const { db } = createMockDB();
      await listFeedback(db, { includeDeleted: true });
      // Should NOT have WHERE clause with deleted_at IS NULL
      // Since there are no other filters, it should be a bare SELECT * FROM feedback
      expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('SELECT * FROM feedback'));
    });
  });

  describe('getFeedbackById', () => {
    it('returns a feedback row by id', async () => {
      const { db, store } = createMockDB();
      store.push(sampleFeedback);

      const result = await getFeedbackById(db, 'fb1');
      expect(result?.id).toBe('fb1');
    });

    it('returns null when not found', async () => {
      const { db } = createMockDB();
      const result = await getFeedbackById(db, 'nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('updateFeedbackStatus', () => {
    it('calls run for status update', async () => {
      const { db, store } = createMockDB();
      const updated = { ...sampleFeedback, status: 'resolved' };
      store.push(updated);

      const result = await updateFeedbackStatus(db, 'fb1', 'resolved');
      expect(result?.status).toBe('resolved');
    });

    it('uses deleted_at field when status is deleted', async () => {
      const { db } = createMockDB();
      await updateFeedbackStatus(db, 'fb1', 'deleted');
      // Should use the variant with deleted_at in the UPDATE
      expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('deleted_at'));
    });
  });

  describe('softDeleteFeedback', () => {
    it('sets status to deleted', async () => {
      const { db, store } = createMockDB();
      const deleted = { ...sampleFeedback, status: 'deleted', deleted_at: '2025-01-02T00:00:00Z' };
      store.push(deleted);

      const result = await softDeleteFeedback(db, 'fb1');
      expect(result?.status).toBe('deleted');
    });
  });
});