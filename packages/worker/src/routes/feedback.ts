import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import type { Bindings, Variables } from '../index.js';
import { createFeedback, listFeedback, getFeedbackById, updateFeedbackStatus, softDeleteFeedback } from '../db/feedback-repo.js';
import { getProjectBySlug } from '../db/projects-repo.js';
import { storeScreenshot, storeDOMSnapshot, getScreenshot, getDOMSnapshot } from '../storage/r2.js';
import { validateFeedbackMetadata, validateDOMSnapshot } from '@feedback/shared';

type AppEnv = { Bindings: Bindings; Variables: Variables };

const feedback = new Hono<AppEnv>();

// POST / — Submit feedback
feedback.post('/', async (c) => {
  try {
    const formData = await c.req.parseBody();

    const metadataRaw = formData.metadata;
    if (typeof metadataRaw !== 'string') {
      return c.json({ error: 'metadata is required and must be a JSON string' }, 400);
    }

    let metadataObj: unknown;
    try {
      metadataObj = JSON.parse(metadataRaw);
    } catch {
      return c.json({ error: 'metadata must be valid JSON' }, 400);
    }

    const metadataValidation = validateFeedbackMetadata(metadataObj);
    if (!metadataValidation.valid) {
      return c.json({ error: metadataValidation.error }, 400);
    }
    const metadata = metadataValidation.data;

    const screenshot = formData.screenshot;
    if (screenshot && !(screenshot instanceof File)) {
      return c.json({ error: 'screenshot must be a file' }, 400);
    }

    const domSnapshotRaw = formData['dom-snapshot'];
    // The SDK sends dom-snapshot as a Blob/File, but it could also be a plain string
    let domSnapshotStr: string | null = null;
    if (domSnapshotRaw instanceof File) {
      domSnapshotStr = await domSnapshotRaw.text();
    } else if (typeof domSnapshotRaw === 'string') {
      domSnapshotStr = domSnapshotRaw;
    } else if (domSnapshotRaw) {
      return c.json({ error: 'dom-snapshot must be a JSON string or file' }, 400);
    }

    let domSnapshotObj: unknown;
    try {
      domSnapshotObj = domSnapshotStr ? JSON.parse(domSnapshotStr) : null;
    } catch {
      return c.json({ error: 'dom-snapshot must be valid JSON' }, 400);
    }

    if (domSnapshotObj) {
      const snapshotValidation = validateDOMSnapshot(domSnapshotObj);
      if (!snapshotValidation.valid) {
        return c.json({ error: snapshotValidation.error }, 400);
      }
    }

    const id = nanoid();

    // Resolve projectId: could be a nanoid or a slug
    let resolvedProjectId = metadata.projectId;
    const existingProject = await getProjectBySlug(c.env.DB, metadata.projectId);
    if (existingProject) {
      resolvedProjectId = existingProject.id;
    }

    // Store R2 objects
    if (screenshot instanceof File) {
      const buf = await screenshot.arrayBuffer();
      await storeScreenshot(c.env.FEEDBACK_BUCKET, id, new Uint8Array(buf));
    }

    if (domSnapshotObj) {
      await storeDOMSnapshot(c.env.FEEDBACK_BUCKET, id, domSnapshotObj);
    }

    // Insert into D1
    const row = await createFeedback(c.env.DB, {
      id,
      project_id: resolvedProjectId,
      category: metadata.category,
      comment: metadata.comment,
      selector: metadata.selector,
      url: metadata.url,
      viewport_width: metadata.viewportWidth,
      viewport_height: metadata.viewportHeight,
      user_agent: metadata.userAgent,
      capture_method: metadata.captureMethod,
    });

    return c.json({ id: row.id }, 201);
  } catch (error) {
    console.error('[Feedback] Submit error:', error instanceof Error ? error.message : String(error));
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET / — List feedback with cursor pagination
feedback.get('/', async (c) => {
  const cursor = c.req.query('cursor') ?? undefined;
  const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!, 10) : undefined;
  const status = c.req.query('status') ?? undefined;
  const category = c.req.query('category') ?? undefined;
  const projectId = c.req.query('projectId') ?? undefined;
  const sort = (c.req.query('sort') as 'created_at' | 'updated_at') ?? undefined;
  const order = (c.req.query('order') as 'asc' | 'desc') ?? undefined;
  const includeDeleted = c.req.query('includeDeleted') === 'true';

  const result = await listFeedback(c.env.DB, {
    cursor,
    limit,
    status,
    category,
    projectId,
    sort,
    order,
    includeDeleted,
  });

  return c.json({ items: result.items, cursor: result.cursor });
});

// GET /:id — Single feedback item
feedback.get('/:id', async (c) => {
  const id = c.req.param('id');
  const row = await getFeedbackById(c.env.DB, id);

  if (!row) {
    return c.json({ error: 'Not found' }, 404);
  }

  return c.json({
    ...row,
    screenshotUrl: `/api/v1/feedback/${id}/screenshot`,
    domSnapshotUrl: `/api/v1/feedback/${id}/dom-snapshot`,
  });
});

// PATCH /:id/status — Update feedback status (requires auth)
feedback.patch('/:id/status', async (c) => {
  const auth = c.get('auth');
  if (auth.email === null) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const id = c.req.param('id');
  const body = await c.req.json<{ status: string }>();
  const validStatuses = ['resolved', 'dismissed'];

  if (!validStatuses.includes(body.status)) {
    return c.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, 400);
  }

  const row = await updateFeedbackStatus(c.env.DB, id, body.status);
  if (!row) {
    return c.json({ error: 'Not found' }, 404);
  }

  return c.json({ id: row.id, status: row.status });
});

// DELETE /:id — Soft-delete feedback (requires auth)
feedback.delete('/:id', async (c) => {
  const auth = c.get('auth');
  if (auth.email === null) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const id = c.req.param('id');
  const row = await softDeleteFeedback(c.env.DB, id);
  if (!row) {
    return c.json({ error: 'Not found' }, 404);
  }

  return c.json({ id: row.id, status: 'deleted' });
});

// GET /:id/screenshot — Stream screenshot from R2
feedback.get('/:id/screenshot', async (c) => {
  const id = c.req.param('id');
  const obj = await getScreenshot(c.env.FEEDBACK_BUCKET, id);

  if (!obj || !obj.body) {
    return c.json({ error: 'Screenshot not found' }, 404);
  }

  return new Response(obj.body, {
    headers: { 'Content-Type': obj.httpMetadata?.contentType ?? 'image/png', 'Cache-Control': 'public, max-age=31536000' },
  });
});

// GET /:id/dom-snapshot — Stream DOM snapshot from R2
feedback.get('/:id/dom-snapshot', async (c) => {
  const id = c.req.param('id');
  const obj = await getDOMSnapshot(c.env.FEEDBACK_BUCKET, id);

  if (!obj || !obj.body) {
    return c.json({ error: 'DOM snapshot not found' }, 404);
  }

  return new Response(obj.body, {
    headers: { 'Content-Type': obj.httpMetadata?.contentType ?? 'application/json', 'Cache-Control': 'public, max-age=31536000' },
  });
});

export { feedback };