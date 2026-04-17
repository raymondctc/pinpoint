import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { Bindings, Variables } from '../../index.js';
import { feedback } from '../feedback.js';

type AppEnv = { Bindings: Bindings; Variables: Variables };

function createMockEnv(): Bindings {
  const store = new Map<string, unknown>();
  const bucket = {
    put: vi.fn(async (key: string, value: unknown) => {
      store.set(key, value);
      return { key };
    }),
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    head: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(),
  };

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
    FEEDBACK_BUCKET: bucket as unknown as R2Bucket,
    ASSETS: { fetch: vi.fn() } as unknown as Fetcher,
    ALLOWED_ORIGINS: '*',
    CF_ACCESS_TEAM_DOMAIN: '',
  };
}

function createApp(env: Bindings) {
  const app = new Hono<AppEnv>();
  app.use('*', async (c, next) => {
    c.env = env as never;
    c.set('auth', { email: 'admin@example.com' });
    await next();
  });
  app.route('/api/v1/feedback', feedback);
  return app;
}

describe('feedback routes', () => {
  let env: Bindings;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
  });

  describe('GET /', () => {
    it('returns empty list', async () => {
      const app = createApp(env);
      const res = await app.request('/api/v1/feedback');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('items');
      expect(body).toHaveProperty('cursor');
    });

    it('passes query parameters to listFeedback', async () => {
      const app = createApp(env);
      const res = await app.request('/api/v1/feedback?status=open&limit=10');
      expect(res.status).toBe(200);
    });
  });

  describe('GET /:id', () => {
    it('returns 404 for missing feedback', async () => {
      const app = createApp(env);
      const res = await app.request('/api/v1/feedback/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /:id/status', () => {
    it('returns 401 without auth', async () => {
      const app = new Hono<AppEnv>();
      app.use('*', async (c, next) => {
        c.env = env as never;
        c.set('auth', { email: null });
        await next();
      });
      app.route('/api/v1/feedback', feedback);

      const res = await app.request('/api/v1/feedback/fb1/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'resolved' }),
      });
      expect(res.status).toBe(401);
    });

    it('returns 400 for invalid status', async () => {
      const app = createApp(env);
      const res = await app.request('/api/v1/feedback/fb1/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'invalid' }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /:id', () => {
    it('returns 401 without auth', async () => {
      const app = new Hono<AppEnv>();
      app.use('*', async (c, next) => {
        c.env = env as never;
        c.set('auth', { email: null });
        await next();
      });
      app.route('/api/v1/feedback', feedback);

      const res = await app.request('/api/v1/feedback/fb1', { method: 'DELETE' });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /:id/screenshot', () => {
    it('returns 404 when screenshot not found', async () => {
      const app = createApp(env);
      const res = await app.request('/api/v1/feedback/fb1/screenshot');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /:id/dom-snapshot', () => {
    it('returns 404 when snapshot not found', async () => {
      const app = createApp(env);
      const res = await app.request('/api/v1/feedback/fb1/dom-snapshot');
      expect(res.status).toBe(404);
    });
  });
});