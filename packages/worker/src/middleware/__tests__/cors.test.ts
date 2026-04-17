import { Hono } from 'hono';
import { describe, it, expect } from 'vitest';
import type { Bindings, Variables } from '../../index.js';
import { createCorsMiddleware } from '../cors.js';

type AppEnv = { Bindings: Bindings; Variables: Variables };

function createApp(allowedOrigins: string) {
  const app = new Hono<AppEnv>();
  app.use('*', createCorsMiddleware());
  app.get('/test', (c) => c.json({ ok: true }));

  // Inject ALLOWED_ORIGINS for testing via env override
  app.use('*', async (c, next) => {
    // This runs after the CORS middleware since it's added second,
    // so we need a different approach — override env before CORS
    await next();
  });

  return app;
}

function createTestApp(allowedOrigins: string) {
  const app = new Hono<AppEnv>();
  app.use('*', async (c, next) => {
    // Override env before CORS middleware runs
    Object.defineProperty(c.env, 'ALLOWED_ORIGINS', {
      value: allowedOrigins,
      configurable: true,
    });
    // Also set up other required env fields
    Object.defineProperty(c.env, 'DB', { value: {} as never, configurable: true });
    Object.defineProperty(c.env, 'FEEDBACK_BUCKET', { value: {} as never, configurable: true });
    Object.defineProperty(c.env, 'ASSETS', { value: {} as never, configurable: true });
    Object.defineProperty(c.env, 'CF_ACCESS_TEAM_DOMAIN', { value: '', configurable: true });
    await next();
  });
  app.use('*', createCorsMiddleware());
  app.get('/test', (c) => c.json({ ok: true }));
  return app;
}

// Alternative approach: create app with injected env
function createAppWithEnv(allowedOrigins: string) {
  const app = new Hono<AppEnv>();
  app.use('*', createCorsMiddleware());
  app.get('/test', (c) => c.json({ ok: true }));

  // Override the fetch to inject env
  const originalFetch = app.fetch.bind(app);
  app.fetch = (req: Request, env?: unknown, executionContext?: ExecutionContext) => {
    const testEnv = {
      ALLOWED_ORIGINS: allowedOrigins,
      DB: {} as never,
      FEEDBACK_BUCKET: {} as never,
      ASSETS: {} as never,
      CF_ACCESS_TEAM_DOMAIN: '',
    };
    return originalFetch(req, testEnv as AppEnv['Bindings'], executionContext as ExecutionContext);
  };

  return app;
}

describe('CORS middleware', () => {
  it('allows any origin when ALLOWED_ORIGINS is "*"', async () => {
    const app = createAppWithEnv('*');
    const res = await app.fetch(new Request('http://localhost/test', {
      headers: { Origin: 'https://example.com' },
    }));

    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');
  });

  it('allows any origin with wildcard when no Origin header is present', async () => {
    const app = createAppWithEnv('*');
    const res = await app.fetch(new Request('http://localhost/test'));

    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('allows matching origins from comma-separated list', async () => {
    const app = createAppWithEnv('https://example.com, https://other.com');
    const res = await app.fetch(new Request('http://localhost/test', {
      headers: { Origin: 'https://example.com' },
    }));

    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');
  });

  it('returns empty origin for non-matching origins', async () => {
    const app = createAppWithEnv('https://example.com, https://other.com');
    const res = await app.fetch(new Request('http://localhost/test', {
      headers: { Origin: 'https://evil.com' },
    }));

    // Hono cors with empty string origin does not set Access-Control-Allow-Origin
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('includes correct methods and headers on OPTIONS preflight', async () => {
    const app = createAppWithEnv('*');
    const res = await app.fetch(new Request('http://localhost/test', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://example.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type',
      },
    }));

    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Methods')).toBe('GET,POST,PATCH,DELETE,OPTIONS');
    expect(res.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type,Cf-Access-Jwt-Assertion');
    expect(res.headers.get('Access-Control-Max-Age')).toBe('86400');
  });

  it('sets CORS headers on regular GET responses', async () => {
    const app = createAppWithEnv('https://example.com');
    const res = await app.fetch(new Request('http://localhost/test', {
      headers: { Origin: 'https://example.com' },
    }));

    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });
});