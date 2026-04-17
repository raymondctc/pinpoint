import { cors } from 'hono/cors';
import type { Context, Next } from 'hono';
import type { Bindings, Variables } from '../index.js';

type AppEnv = { Bindings: Bindings; Variables: Variables };

export function createCorsMiddleware() {
  return async (c: Context<AppEnv>, next: Next) => {
    const origins = c.env.ALLOWED_ORIGINS;
    const origin = c.req.header('Origin') ?? '';

    let allowedOrigin = '';
    if (origins === '*') {
      allowedOrigin = origin || '*';
    } else {
      const allowedList = origins.split(',').map((o: string) => o.trim());
      if (allowedList.includes(origin)) {
        allowedOrigin = origin;
      }
    }

    return cors({
      origin: allowedOrigin,
      allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Cf-Access-Jwt-Assertion'],
      maxAge: 86400,
    })(c, next);
  };
}