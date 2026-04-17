import { Hono } from 'hono';

const app = new Hono();

// In-memory store for dev preview
const feedbackStore = new Map<string, Record<string, unknown>>();
const projectStore = new Map<string, Record<string, unknown>>();

// CORS headers for development
app.use('*', async (c, next) => {
  await next();
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'POST, GET, PATCH, DELETE, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Cf-Access-Jwt-Assertion');
  c.header('Access-Control-Max-Age', '86400');
});

app.options('*', (c) => new Response(null, { status: 204 }));

// ── Feedback ──────────────────────────────────────────────────────────

app.post('/api/v1/feedback', async (c) => {
  const formData = await c.req.formData();

  const metadata = formData.get('metadata');
  if (!metadata || typeof metadata !== 'string') {
    return c.json({ error: 'metadata is required and must be a JSON string' }, 400);
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(metadata);
  } catch {
    return c.json({ error: 'metadata must be valid JSON' }, 400);
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const entry: Record<string, unknown> = {
    id,
    project_id: parsed.projectId ?? 'default',
    status: 'open',
    category: parsed.category ?? null,
    comment: parsed.comment ?? '',
    selector: parsed.selector ?? null,
    url: parsed.url ?? null,
    viewport_width: parsed.viewportWidth ?? null,
    viewport_height: parsed.viewportHeight ?? null,
    user_agent: parsed.userAgent ?? null,
    created_by: 'anonymous',
    capture_method: parsed.captureMethod ?? 'html2canvas',
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };

  feedbackStore.set(id, entry);

  console.log('[MockWorker] Feedback received:', {
    id,
    comment: (parsed.comment as string)?.slice(0, 80),
    screenshotSize: formData.get('screenshot') instanceof Blob ? (formData.get('screenshot') as Blob).size : 0,
  });

  return c.json({ id }, 201);
});

app.get('/api/v1/feedback', async (c) => {
  const status = c.req.query('status');
  const category = c.req.query('category');
  const projectId = c.req.query('projectId');
  const limit = parseInt(c.req.query('limit') ?? '25', 10);
  const cursor = c.req.query('cursor');

  let items = Array.from(feedbackStore.values());

  // Filter out deleted by default
  if (c.req.query('includeDeleted') !== 'true') {
    items = items.filter((item) => item.deleted_at === null);
  }
  if (status) items = items.filter((item) => item.status === status);
  if (category) items = items.filter((item) => item.category === category);
  if (projectId) items = items.filter((item) => item.project_id === projectId);

  // Sort by created_at descending
  items.sort((a, b) => (b.created_at as string).localeCompare(a.created_at as string));

  // Cursor pagination
  if (cursor) {
    const { created_at: cursorDate, id: cursorId } = JSON.parse(atob(cursor));
    const idx = items.findIndex((item) => item.created_at === cursorDate && item.id === cursorId);
    if (idx >= 0) items = items.slice(idx + 1);
  }

  const hasMore = items.length > limit;
  const paged = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore && paged.length > 0
    ? btoa(JSON.stringify({ created_at: paged[paged.length - 1].created_at, id: paged[paged.length - 1].id }))
    : null;

  return c.json({ items: paged, cursor: nextCursor });
});

app.get('/api/v1/feedback/:id', async (c) => {
  const id = c.req.param('id');
  const entry = feedbackStore.get(id);
  if (!entry) return c.json({ error: 'Not found' }, 404);

  return c.json({
    ...entry,
    screenshotUrl: `/api/v1/feedback/${id}/screenshot`,
    domSnapshotUrl: `/api/v1/feedback/${id}/dom-snapshot`,
  });
});

app.patch('/api/v1/feedback/:id/status', async (c) => {
  const id = c.req.param('id');
  const entry = feedbackStore.get(id);
  if (!entry) return c.json({ error: 'Not found' }, 404);

  const body = await c.req.json<{ status: string }>();
  const validStatuses = ['resolved', 'dismissed'];
  if (!validStatuses.includes(body.status)) {
    return c.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, 400);
  }

  entry.status = body.status;
  entry.updated_at = new Date().toISOString();
  return c.json({ id, status: body.status });
});

app.delete('/api/v1/feedback/:id', async (c) => {
  const id = c.req.param('id');
  const entry = feedbackStore.get(id);
  if (!entry) return c.json({ error: 'Not found' }, 404);

  entry.status = 'deleted';
  entry.deleted_at = new Date().toISOString();
  entry.updated_at = new Date().toISOString();
  return c.json({ id, status: 'deleted' });
});

app.get('/api/v1/feedback/:id/screenshot', async (c) => {
  const id = c.req.param('id');
  if (!feedbackStore.has(id)) return c.json({ error: 'Screenshot not found' }, 404);
  // Mock: return 1x1 transparent PNG
  const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const binary = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new Response(binary, { headers: { 'Content-Type': 'image/png' } });
});

app.get('/api/v1/feedback/:id/dom-snapshot', async (c) => {
  const id = c.req.param('id');
  if (!feedbackStore.has(id)) return c.json({ error: 'DOM snapshot not found' }, 404);
  return c.json({ tagName: 'div', selector: 'body', textContent: null, attributes: {}, computedStyles: {}, boundingRect: { x: 0, y: 0, width: 0, height: 0 }, children: [] });
});

// ── Projects ──────────────────────────────────────────────────────────

app.get('/api/v1/projects', async (c) => {
  const items = Array.from(projectStore.values());
  return c.json({ items });
});

app.post('/api/v1/projects', async (c) => {
  const body = await c.req.json<{ name: string; slug: string }>();
  if (!body.name || typeof body.name !== 'string') {
    return c.json({ error: 'name is required' }, 400);
  }
  if (!body.slug || typeof body.slug !== 'string') {
    return c.json({ error: 'slug is required' }, 400);
  }

  // Check slug uniqueness
  for (const project of projectStore.values()) {
    if (project.slug === body.slug) {
      return c.json({ error: 'A project with this slug already exists' }, 409);
    }
  }

  const id = crypto.randomUUID();
  const project = {
    id,
    name: body.name,
    slug: body.slug,
    created_at: new Date().toISOString(),
  };
  projectStore.set(id, project);

  return c.json({ id, name: body.name, slug: body.slug }, 201);
});

// ── Health ────────────────────────────────────────────────────────────

app.get('/api/health', (c) => c.json({ status: 'ok' }));

export default app;