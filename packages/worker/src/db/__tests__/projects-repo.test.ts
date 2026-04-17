import { describe, it, expect, vi } from 'vitest';
import { listProjects, createProject, getProjectBySlug } from '../projects-repo.js';

function createMockDB() {
  const store: Record<string, unknown>[] = [];

  const db = {
    prepare: vi.fn((sql: string) => {
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

describe('projects-repo', () => {
  describe('listProjects', () => {
    it('queries and returns projects', async () => {
      const { db, store } = createMockDB();
      store.push({ id: '1', name: 'Project A', slug: 'project-a', created_at: '2025-01-01T00:00:00Z' });

      const result = await listProjects(db);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Project A');
    });
  });

  describe('createProject', () => {
    it('inserts a project and returns it', async () => {
      const { db, store } = createMockDB();
      const mockRow = { id: 'proj1', name: 'Test', slug: 'test', created_at: '2025-01-01T00:00:00Z' };
      store.push(mockRow);

      const result = await createProject(db, { id: 'proj1', name: 'Test', slug: 'test' });
      expect(result.id).toBe('proj1');
      expect(result.name).toBe('Test');
    });
  });

  describe('getProjectBySlug', () => {
    it('returns a project by slug', async () => {
      const { db, store } = createMockDB();
      store.push({ id: '1', name: 'Test', slug: 'test-slug', created_at: '2025-01-01T00:00:00Z' });

      const result = await getProjectBySlug(db, 'test-slug');
      expect(result?.slug).toBe('test-slug');
    });

    it('returns null when slug not found', async () => {
      const { db } = createMockDB();

      const result = await getProjectBySlug(db, 'nonexistent');
      expect(result).toBeNull();
    });
  });
});