import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import type { Bindings, Variables } from '../index.js';
import { listProjects, createProject, getProjectBySlug } from '../db/projects-repo.js';

type AppEnv = { Bindings: Bindings; Variables: Variables };

const projects = new Hono<AppEnv>();

// GET / — List all projects
projects.get('/', async (c) => {
  const items = await listProjects(c.env.DB);
  return c.json({ items });
});

// POST / — Create a project (requires auth)
projects.post('/', async (c) => {
  const auth = c.get('auth');
  if (auth.email === null) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const body = await c.req.json<{ name: string; slug: string }>();

  if (!body.name || typeof body.name !== 'string') {
    return c.json({ error: 'name is required' }, 400);
  }

  if (!body.slug || typeof body.slug !== 'string') {
    return c.json({ error: 'slug is required' }, 400);
  }

  // Check for slug uniqueness
  const existing = await getProjectBySlug(c.env.DB, body.slug);
  if (existing) {
    return c.json({ error: 'A project with this slug already exists' }, 409);
  }

  const id = nanoid();
  const project = await createProject(c.env.DB, { id, name: body.name, slug: body.slug });

  return c.json({ id: project.id, name: project.name, slug: project.slug }, 201);
});

export { projects };