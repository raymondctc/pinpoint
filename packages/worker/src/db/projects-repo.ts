import type { D1Database } from '@cloudflare/workers-types';

export interface ProjectRow {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export async function listProjects(db: D1Database): Promise<ProjectRow[]> {
  const result = await db.prepare('SELECT id, name, slug, created_at FROM projects ORDER BY created_at DESC').all();
  return result.results as unknown as ProjectRow[];
}

export async function createProject(
  db: D1Database,
  params: { id: string; name: string; slug: string },
): Promise<ProjectRow> {
  await db
    .prepare('INSERT INTO projects (id, name, slug) VALUES (?, ?, ?)')
    .bind(params.id, params.name, params.slug)
    .run();

  const result = await db
    .prepare('SELECT id, name, slug, created_at FROM projects WHERE id = ?')
    .bind(params.id)
    .first<ProjectRow>();

  return result!;
}

export async function getProjectBySlug(db: D1Database, slug: string): Promise<ProjectRow | null> {
  return db
    .prepare('SELECT id, name, slug, created_at FROM projects WHERE slug = ?')
    .bind(slug)
    .first<ProjectRow>();
}