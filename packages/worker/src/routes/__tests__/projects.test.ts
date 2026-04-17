import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { Bindings, Variables } from '../../index.js';
import { projects } from '../projects.js';

type AppEnv = { Bindings: Bindings; Variables: Variables };

function createMockEnv(): Bindings {
  return {
    DB: {
      prepare: vi.fn(() => {
        const s = {
          bind: vi.fn(function (this: unknown, ..._args: unknown[]) { return s; }),
          run: vi.fn(async () => ({})),
          all: vi.fn(async () => ({ results: [] })),
          first: vi.fn(async () => null),
        };
        return s;
      }),
    } as unknown as import('@cloudflare/workers-types').D1Database,
    FEEDBACK_BUCKET: {} as R2Bucket,
    ASSETS: {} as Fetcher,
    ALLOWED_ORIGINS: '*',
    CF_ACCESS_TEAM_DOMAIN: '',
  };
}

function createApp(env: Bindings, authEmail: string | null = 'admin@example.com') {
  const app = new Hono<AppEnv>();
  app.use('*', async (c, next) => {
    c.env = env as never;
    c.set('auth', { email: authEmail });
    await next();
  });
  app.route('/api/v1/projects', projects);
  return app;
}

describe('projects routes', () => {
  let env: Bindings;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
  });

  describe('GET /', () => {
    it('returns empty list', async () => {
      const app = createApp(env);
      const res = await app.request('/api/v1/projects');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('items');
    });
  });

  describe('POST /', () => {
    it('returns 401 without auth', async () => {
      const app = createApp(env, null);
      const res = await app.request('/api/v1/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test', slug: 'test' }),
      });
      expect(res.status).toBe(401);
    });

    it('returns 400 for missing name', async () => {
      const app = createApp(env);
      const res = await app.request('/api/v1/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: 'test' }),
      });
      expect(res.status).toBe(400);
    });

    it('returns 400 for missing slug', async () => {
      const app = createApp(env);
      const res = await app.request('/api/v1/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test' }),
      });
      expect(res.status).toBe(400);
    });
  });
});