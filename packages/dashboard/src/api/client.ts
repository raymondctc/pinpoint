export interface FeedbackListParams {
  cursor?: string;
  limit?: number;
  status?: string;
  category?: string;
  projectId?: string;
  sort?: 'created_at' | 'updated_at';
  order?: 'asc' | 'desc';
  includeDeleted?: boolean;
}

export interface FeedbackItem {
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
  screenshotUrl?: string;
  domSnapshotUrl?: string;
}

export interface FeedbackListResponse {
  items: FeedbackItem[];
  cursor: string | null;
}

export interface ProjectItem {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface ProjectListResponse {
  items: ProjectItem[];
}

const API_BASE = '/api/v1';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }

  return res.json();
}

export async function fetchFeedbackList(params: FeedbackListParams = {}): Promise<FeedbackListResponse> {
  const searchParams = new URLSearchParams();
  if (params.cursor) searchParams.set('cursor', params.cursor);
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.status) searchParams.set('status', params.status);
  if (params.category) searchParams.set('category', params.category);
  if (params.projectId) searchParams.set('projectId', params.projectId);
  if (params.sort) searchParams.set('sort', params.sort);
  if (params.order) searchParams.set('order', params.order);
  if (params.includeDeleted) searchParams.set('includeDeleted', 'true');

  const qs = searchParams.toString();
  return request<FeedbackListResponse>(`/feedback${qs ? `?${qs}` : ''}`);
}

export async function fetchFeedbackItem(id: string): Promise<FeedbackItem> {
  return request<FeedbackItem>(`/feedback/${id}`);
}

export async function updateFeedbackStatus(id: string, status: string): Promise<{ id: string; status: string }> {
  return request<{ id: string; status: string }>(`/feedback/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function deleteFeedback(id: string): Promise<{ id: string; status: string }> {
  return request<{ id: string; status: string }>(`/feedback/${id}`, {
    method: 'DELETE',
  });
}

export async function fetchProjects(): Promise<ProjectListResponse> {
  return request<ProjectListResponse>('/projects');
}

export async function createProject(name: string, slug: string): Promise<ProjectItem> {
  return request<ProjectItem>('/projects', {
    method: 'POST',
    body: JSON.stringify({ name, slug }),
  });
}

export function getScreenshotUrl(id: string): string {
  return `${API_BASE}/feedback/${id}/screenshot`;
}

export function getDOMSnapshotUrl(id: string): string {
  return `${API_BASE}/feedback/${id}/dom-snapshot`;
}