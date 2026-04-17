import { useState } from 'react';
import { useNavigate } from 'react-router';
import { usePinpointList, useUpdateFeedbackStatus, useDeleteFeedback } from '../api/hooks.js';
import { getScreenshotUrl } from '../api/client.js';
import type { FeedbackListParams } from '../api/client.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { CategoryBadge } from '../components/CategoryBadge.js';
import { FilterBar } from '../components/FilterBar.js';
import { PaginationControls } from '../components/PaginationControls.js';

function relativeDate(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMonth = Math.floor(diffDay / 30);
  return `${diffMonth}mo ago`;
}

function getHostname(url: string | null): string {
  if (!url) return '—';
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + '...' : str;
}

export function FeedbackList() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<FeedbackListParams>({ limit: 20, sort: 'created_at', order: 'desc' });
  const [cursors, setCursors] = useState<string[]>([]);
  const [allItems, setAllItems] = useState<{ id: string; status: string }[]>([]);

  const currentCursor = cursors.length > 0 ? cursors[cursors.length - 1] : undefined;
  const { data, isLoading, error } = usePinpointList({ ...filters, cursor: currentCursor });
  const updateStatus = useUpdateFeedbackStatus();
  const deleteMutation = useDeleteFeedback();

  const handleLoadMore = (cursor: string) => {
    setCursors((prev) => [...prev, cursor]);
  };

  const handleStatusChange = (id: string, status: string) => {
    updateStatus.mutate(
      { id, status },
      {
        onSuccess: (result) => {
          setAllItems((prev) => prev.map((item) => (item.id === result.id ? { ...item, status: result.status } : item)));
        },
      },
    );
  };

  const handleDelete = (id: string) => {
    if (!window.confirm('Delete this feedback item?')) return;
    deleteMutation.mutate(id);
  };

  if (error) {
    return (
      <div style={{ color: '#dc2626', padding: '24px' }}>
        Error loading feedback: {error.message}
      </div>
    );
  }

  const items = data?.items ?? [];
  const totalShown = items.length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>
          Feedback {totalShown > 0 && <span style={{ fontSize: '16px', fontWeight: 400, color: '#6b7280' }}>({totalShown})</span>}
        </h1>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <FilterBar filters={filters} onChange={setFilters} />
      </div>

      {isLoading && items.length === 0 ? (
        <div style={{ padding: '48px', textAlign: 'center', color: '#6b7280' }}>Loading...</div>
      ) : items.length === 0 ? (
        <div style={{ padding: '48px', textAlign: 'center', color: '#6b7280' }}>No feedback found.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <thead>
            <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              <th style={thStyle}>Screenshot</th>
              <th style={thStyle}>Comment</th>
              <th style={thStyle}>Category</th>
              <th style={thStyle}>Selector</th>
              <th style={thStyle}>URL</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Created</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                onClick={() => navigate(`/feedback/${item.id}`)}
                style={{ cursor: 'pointer', borderBottom: '1px solid #e5e7eb' }}
              >
                <td style={tdStyle}>
                  <img
                    src={getScreenshotUrl(item.id)}
                    alt="Screenshot"
                    style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #e5e7eb' }}
                  />
                </td>
                <td style={tdStyle}>{truncate(item.comment, 100)}</td>
                <td style={tdStyle}><CategoryBadge category={item.category} /></td>
                <td style={tdStyle}>{item.selector ? truncate(item.selector, 60) : '—'}</td>
                <td style={tdStyle}>{getHostname(item.url)}</td>
                <td style={tdStyle}><StatusBadge status={item.status} /></td>
                <td style={tdStyle}>{relativeDate(item.created_at)}</td>
                <td style={tdStyle}>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {item.status === 'open' && (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleStatusChange(item.id, 'resolved'); }}
                          disabled={updateStatus.isPending}
                          style={actionBtnStyle('#15803d')}
                        >
                          Resolve
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleStatusChange(item.id, 'dismissed'); }}
                          disabled={updateStatus.isPending}
                          style={actionBtnStyle('#b45309')}
                        >
                          Dismiss
                        </button>
                      </>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                      disabled={deleteMutation.isPending}
                      style={actionBtnStyle('#dc2626')}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <PaginationControls
        cursor={data?.cursor ?? null}
        onLoadMore={handleLoadMore}
        isLoading={isLoading}
      />
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 12px',
  fontSize: '12px',
  fontWeight: 600,
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: '14px',
  color: '#374151',
  verticalAlign: 'middle',
};

function actionBtnStyle(color: string): React.CSSProperties {
  return {
    padding: '4px 8px',
    fontSize: '12px',
    borderRadius: '4px',
    border: `1px solid ${color}`,
    backgroundColor: 'transparent',
    color,
    cursor: 'pointer',
  };
}