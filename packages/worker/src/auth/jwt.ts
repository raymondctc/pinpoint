import { jwtVerify } from 'jose';
import type { Context, Next } from 'hono';
import type { Bindings, Variables } from '../index.js';

type AppEnv = { Bindings: Bindings; Variables: Variables };

// Module-level JWKS cache: Map<teamDomain, { keys: JsonWebKey[]; expiresAt: number }>
const jwksCache = new Map<string, { keys: JsonWebKey[]; expiresAt: number }>();

const JWKS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/** @internal Clear JWKS cache — for testing only */
export function _clearJWKSCache() {
  jwksCache.clear();
}

async function fetchJWKS(teamDomain: string): Promise<JsonWebKey[]> {
  const cached = jwksCache.get(teamDomain);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.keys;
  }

  const url = `https://${teamDomain}/cdn-cgi/access/certs`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch JWKS from ${url}: ${res.status}`);
  }

  const data = (await res.json()) as { keys: JsonWebKey[] };
  const keys = data.keys;

  jwksCache.set(teamDomain, { keys, expiresAt: Date.now() + JWKS_CACHE_TTL_MS });
  return keys;
}

export function createAuthMiddleware(teamDomainGetter: (c: Context<AppEnv>) => string) {
  return async (c: Context<AppEnv>, next: Next) => {
    const teamDomain = teamDomainGetter(c);

    // Dev mode: no team domain configured → skip auth, allow all operations
    if (!teamDomain) {
      c.set('auth', { email: 'dev@localhost', isDevMode: true });
      return next();
    }

    const token = c.req.header('Cf-Access-Jwt-Assertion');

    // Missing JWT but team domain is configured → auth required
    if (!token) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    try {
      const keys = await fetchJWKS(teamDomain);

      // Try each key until one verifies
      let payload: Record<string, unknown> | undefined;
      for (const key of keys) {
        try {
          const result = await jwtVerify(token, key, {
            issuer: `https://${teamDomain}`,
          });
          payload = result.payload as Record<string, unknown>;
          break;
        } catch {
          // Try next key
        }
      }

      if (!payload) {
        return c.json({ error: 'Invalid authentication token' }, 401);
      }

      const email = (payload.email as string | undefined) ?? null;
      c.set('auth', { email });
      return next();
    } catch {
      return c.json({ error: 'Invalid authentication token' }, 401);
    }
  };
}

export async function requireAuthMiddleware(c: Context<AppEnv>, next: Next) {
  const auth = c.get('auth');
  if (auth.email === null) {
    return c.json({ error: 'Authentication required' }, 401);
  }
  return next();
}