import type { D1Database } from '@cloudflare/workers-types';

export interface FeedbackRow {
  id: string;
  project_id: string;
  status: string;
  category: string | null;
  comment: string;
  selector: string | null;
  url: string | null;
  viewport_width: number | null;
  viewport_height: number | null;
  user_agent: string | null;
  created_by: string;
  capture_method: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ListFeedbackOptions {
  cursor?: string;
  limit?: number;
  status?: string;
  category?: string;
  projectId?: string;
  sort?: 'created_at' | 'updated_at';
  order?: 'asc' | 'desc';
  includeDeleted?: boolean;
}

export interface ListFeedbackResult {
  items: FeedbackRow[];
  cursor: string | null;
}

function decodeCursor(cursor: string): { created_at: string; id: string } {
  return JSON.parse(atob(cursor));
}

function encodeCursor(created_at: string, id: string): string {
  return btoa(JSON.stringify({ created_at, id }));
}

export async function createFeedback(
  db: D1Database,
  params: {
    id: string;
    project_id: string;
    status?: string;
    category?: string | null;
    comment: string;
    selector?: string | null;
    url?: string | null;
    viewport_width?: number | null;
    viewport_height?: number | null;
    user_agent?: string | null;
    created_by?: string;
    capture_method?: string;
  },
): Promise<FeedbackRow> {
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO feedback (id, project_id, status, category, comment, selector, url, viewport_width, viewport_height, user_agent, created_by, capture_method, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      params.id,
      params.project_id,
      params.status ?? 'open',
      params.category ?? null,
      params.comment,
      params.selector ?? null,
      params.url ?? null,
      params.viewport_width ?? null,
      params.viewport_height ?? null,
      params.user_agent ?? null,
      params.created_by ?? 'anonymous',
      params.capture_method ?? 'html2canvas',
      now,
      now,
    )
    .run();

  const result = await db
    .prepare('SELECT * FROM feedback WHERE id = ?')
    .bind(params.id)
    .first<FeedbackRow>();

  return result!;
}

export async function listFeedback(
  db: D1Database,
  options: ListFeedbackOptions = {},
): Promise<ListFeedbackResult> {
  const limit = Math.min(Math.max(options.limit ?? 25, 1), 100);
  const sort = options.sort ?? 'created_at';
  const order = options.order ?? 'desc';

  const conditions: string[] = [];
  const values: unknown[] = [];

  if (!options.includeDeleted) {
    conditions.push('deleted_at IS NULL');
  }

  if (options.projectId) {
    conditions.push('project_id = ?');
    values.push(options.projectId);
  }

  if (options.status) {
    conditions.push('status = ?');
    values.push(options.status);
  }

  if (options.category) {
    conditions.push('category = ?');
    values.push(options.category);
  }

  if (options.cursor) {
    const cursor = decodeCursor(options.cursor);
    if (order === 'desc') {
      conditions.push(`(${sort}, id) <= (?, ?)`);
    } else {
      conditions.push(`(${sort}, id) >= (?, ?)`);
    }
    values.push(cursor.created_at, cursor.id);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `SELECT * FROM feedback ${whereClause} ORDER BY ${sort} ${order.toUpperCase()}, id ${order.toUpperCase()} LIMIT ?`;

  const stmt = db.prepare(sql);
  const result = await stmt.bind(...values, limit + 1).all();
  const rows = result.results as unknown as FeedbackRow[];

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const cursor = hasMore ? encodeCursor(items[items.length - 1][sort as keyof FeedbackRow] as string, items[items.length - 1].id) : null;

  return { items, cursor };
}

export async function getFeedbackById(db: D1Database, id: string): Promise<FeedbackRow | null> {
  return db.prepare('SELECT * FROM feedback WHERE id = ?').bind(id).first<FeedbackRow>();
}

export async function updateFeedbackStatus(
  db: D1Database,
  id: string,
  status: string,
): Promise<FeedbackRow | null> {
  const now = new Date().toISOString();

  if (status === 'deleted') {
    await db
      .prepare('UPDATE feedback SET status = ?, deleted_at = ?, updated_at = ? WHERE id = ?')
      .bind(status, now, now, id)
      .run();
  } else {
    await db
      .prepare('UPDATE feedback SET status = ?, updated_at = ? WHERE id = ?')
      .bind(status, now, id)
      .run();
  }

  return getFeedbackById(db, id);
}

export async function softDeleteFeedback(db: D1Database, id: string): Promise<FeedbackRow | null> {
  return updateFeedbackStatus(db, id, 'deleted');
}