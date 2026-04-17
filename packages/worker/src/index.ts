import { Hono } from 'hono';
import { createAuthMiddleware } from './auth/jwt.js';
import { createCorsMiddleware } from './middleware/cors.js';
import { feedback } from './routes/feedback.js';
import { projects } from './routes/projects.js';

export type Bindings = {
  DB: D1Database;
  FEEDBACK_BUCKET: R2Bucket;
  ASSETS: Fetcher;
  ALLOWED_ORIGINS: string;
  CF_ACCESS_TEAM_DOMAIN: string;
};

export type Variables = {
  auth: { email: string | null; isDevMode?: boolean };
};

type AppEnv = { Bindings: Bindings; Variables: Variables };

const app = new Hono<AppEnv>();

// CORS middleware on all API routes
app.use('/api/*', createCorsMiddleware());

// Auth middleware — extracts CF Access JWT (never blocks)
app.use('/api/*', createAuthMiddleware((c) => c.env.CF_ACCESS_TEAM_DOMAIN));

// Mount route sub-apps
app.route('/api/v1/feedback', feedback);
app.route('/api/v1/projects', projects);

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok' }));

// Fallback for non-API routes: serve dashboard static assets (production only)
app.notFound(async (c) => {
  if (c.env.ASSETS) {
    return c.env.ASSETS.fetch(c.req.raw);
  }
  return c.json({ error: 'Not found' }, 404);
});

export default app;