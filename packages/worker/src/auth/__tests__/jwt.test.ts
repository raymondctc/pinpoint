import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { Bindings, Variables } from '../../index.js';
import { createAuthMiddleware, requireAuthMiddleware, _clearJWKSCache } from '../jwt.js';

type AppEnv = { Bindings: Bindings; Variables: Variables };

// ── Helpers ──────────────────────────────────────────────────────────

function makeApp(teamDomain: string) {
  const app = new Hono<AppEnv>();
  app.use('*', createAuthMiddleware((c) => c.env.CF_ACCESS_TEAM_DOMAIN));
  app.get('/test', (c) => c.json({ auth: c.get('auth') }));
  return app;
}

function makeProtectedApp(teamDomain: string) {
  const app = new Hono<AppEnv>();
  app.use('*', createAuthMiddleware((c) => c.env.CF_ACCESS_TEAM_DOMAIN));
  app.use('*', requireAuthMiddleware);
  app.get('/protected', (c) => c.json({ email: c.get('auth').email }));
  return app;
}

async function request(app: Hono<AppEnv>, headers: Record<string, string> = {}, env?: Partial<Bindings>) {
  const fullEnv: Bindings = {
    DB: {} as Bindings['DB'],
    FEEDBACK_BUCKET: {} as Bindings['FEEDBACK_BUCKET'],
    ASSETS: {} as Bindings['ASSETS'],
    ALLOWED_ORIGINS: '*',
    CF_ACCESS_TEAM_DOMAIN: '',
    ...env,
  };

  return app.request('/test', { headers }, fullEnv as never);
}

async function requestProtected(
  app: Hono<AppEnv>,
  headers: Record<string, string> = {},
  env?: Partial<Bindings>,
) {
  const fullEnv: Bindings = {
    DB: {} as Bindings['DB'],
    FEEDBACK_BUCKET: {} as Bindings['FEEDBACK_BUCKET'],
    ASSETS: {} as Bindings['ASSETS'],
    ALLOWED_ORIGINS: '*',
    CF_ACCESS_TEAM_DOMAIN: '',
    ...env,
  };

  return app.request('/protected', { headers }, fullEnv as never);
}

// ── Mocks ────────────────────────────────────────────────────────────

const mockJwtVerify = vi.hoisted(() => vi.fn());

vi.mock('jose', () => ({
  jwtVerify: mockJwtVerify,
}));

const mockFetch = vi.hoisted(() => vi.fn());

vi.stubGlobal('fetch', mockFetch);

// ── Tests ─────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  _clearJWKSCache();
});

describe('createAuthMiddleware', () => {
  it('skips auth in dev mode (no team domain) and sets dev email', async () => {
    const app = makeApp('');
    const res = await request(app);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ auth: { email: 'dev@localhost', isDevMode: true } });
  });

  it('returns 401 when team domain is configured but JWT header is missing', async () => {
    const app = makeApp('team.example.com');
    const res = await request(app, {}, { CF_ACCESS_TEAM_DOMAIN: 'team.example.com' });
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body).toEqual({ error: 'Authentication required' });
  });

  it('returns 401 for an invalid JWT', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ keys: [{ kty: 'RSA', kid: 'key1' }] }),
    });
    mockJwtVerify.mockRejectedValue(new Error('Invalid signature'));

    const app = makeApp('team.example.com');
    const res = await request(app, { 'Cf-Access-Jwt-Assertion': 'bad-token' }, { CF_ACCESS_TEAM_DOMAIN: 'team.example.com' });
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body).toEqual({ error: 'Invalid authentication token' });
  });

  it('sets auth.email from valid JWT with email claim', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ keys: [{ kty: 'RSA', kid: 'key1' }] }),
    });
    mockJwtVerify.mockResolvedValueOnce({
      payload: { email: 'user@example.com', iss: 'https://team.example.com' },
    });

    const app = makeApp('team.example.com');
    const res = await request(app, { 'Cf-Access-Jwt-Assertion': 'valid-token' }, { CF_ACCESS_TEAM_DOMAIN: 'team.example.com' });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ auth: { email: 'user@example.com' } });
  });

  it('sets auth.email to null for valid JWT without email claim', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ keys: [{ kty: 'RSA', kid: 'key1' }] }),
    });
    mockJwtVerify.mockResolvedValueOnce({
      payload: { iss: 'https://team.example.com' },
    });

    const app = makeApp('team.example.com');
    const res = await request(app, { 'Cf-Access-Jwt-Assertion': 'valid-token' }, { CF_ACCESS_TEAM_DOMAIN: 'team.example.com' });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ auth: { email: null } });
  });
});

describe('requireAuthMiddleware', () => {
  it('allows request in dev mode (no team domain)', async () => {
    const app = makeProtectedApp('');
    const res = await requestProtected(app);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ email: 'dev@localhost' });
  });

  it('blocks request when JWT is present but email is null', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ keys: [{ kty: 'RSA', kid: 'key1' }] }),
    });
    mockJwtVerify.mockResolvedValueOnce({
      payload: { iss: 'https://team.example.com' },
    });

    const app = makeProtectedApp('team.example.com');
    const res = await requestProtected(
      app,
      { 'Cf-Access-Jwt-Assertion': 'valid-token' },
      { CF_ACCESS_TEAM_DOMAIN: 'team.example.com' },
    );
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body).toEqual({ error: 'Authentication required' });
  });

  it('allows request when auth.email is present', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ keys: [{ kty: 'RSA', kid: 'key1' }] }),
    });
    mockJwtVerify.mockResolvedValueOnce({
      payload: { email: 'user@example.com', iss: 'https://team.example.com' },
    });

    const app = makeProtectedApp('team.example.com');
    const res = await requestProtected(
      app,
      { 'Cf-Access-Jwt-Assertion': 'valid-token' },
      { CF_ACCESS_TEAM_DOMAIN: 'team.example.com' },
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ email: 'user@example.com' });
  });
});