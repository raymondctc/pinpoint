import { useState } from 'react';
import { useParams, Link } from 'react-router';
import { usePinpointItem } from '../api/hooks.js';
import { ScreenshotViewer } from '../components/ScreenshotViewer.js';
import { DOMSnapshotRenderer } from '../components/DOMSnapshotRenderer.js';
import { StatusActions } from '../components/StatusActions.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { CategoryBadge } from '../components/CategoryBadge.js';
import type { DOMSnapshotNode } from '@pinpoint/shared';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

export function FeedbackDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: item, isLoading, error } = usePinpointItem(id ?? '');
  const [domSnapshot, setDomSnapshot] = useState<DOMSnapshotNode | null>(null);
  const [domExpanded, setDomExpanded] = useState(false);
  const [domLoaded, setDomLoaded] = useState(false);
  const [domError, setDomError] = useState<string | null>(null);

  const handleStatusUpdate = (_id: string, _status: string) => {
    // Query invalidation is handled by the mutation hook
  };

  const handleDelete = (_id: string) => {
    // Navigate away after delete
  };

  const loadDomSnapshot = async () => {
    if (!id) return;
    setDomExpanded(true);
    if (domLoaded) return;
    try {
      const res = await fetch(`/api/v1/feedback/${id}/dom-snapshot`);
      if (!res.ok) throw new Error('Failed to load DOM snapshot');
      const data: DOMSnapshotNode = await res.json();
      setDomSnapshot(data);
      setDomLoaded(true);
    } catch (err) {
      setDomError(err instanceof Error ? err.message : 'Failed to load DOM snapshot');
    }
  };

  if (!id) {
    return <div style={{ padding: '24px', color: '#6b7280' }}>Invalid feedback ID.</div>;
  }

  if (isLoading) {
    return <div style={{ padding: '24px', color: '#6b7280' }}>Loading...</div>;
  }

  if (error) {
    return <div style={{ padding: '24px', color: '#dc2626' }}>Error: {error.message}</div>;
  }

  if (!item) {
    return <div style={{ padding: '24px', color: '#6b7280' }}>Feedback not found.</div>;
  }

  return (
    <div>
      <Link to="/" style={{ color: '#2563eb', textDecoration: 'none', fontSize: '14px', display: 'inline-block', marginBottom: '16px' }}>
        &larr; Back to list
      </Link>

      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
        {/* Left side: screenshot + DOM snapshot */}
        <div style={{ flex: '3', minWidth: 0 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 12px 0' }}>Screenshot</h2>
            <ScreenshotViewer feedbackId={id} />
          </div>

          {/* Collapsible DOM snapshot section */}
          <div style={{ marginTop: '16px', backgroundColor: '#fff', borderRadius: '8px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <button
              onClick={loadDomSnapshot}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 600,
                padding: 0,
                color: '#374151',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>{domExpanded ? '▼' : '▶'}</span>
              DOM Snapshot
            </button>
            {domExpanded && (
              <div style={{ marginTop: '12px' }}>
                {domError && <div style={{ color: '#dc2626', fontSize: '13px' }}>{domError}</div>}
                {!domLoaded && !domError && <div style={{ color: '#6b7280', fontSize: '13px' }}>Loading...</div>}
                {domLoaded && <DOMSnapshotRenderer node={domSnapshot} />}
              </div>
            )}
          </div>
        </div>

        {/* Right side: metadata */}
        <div style={{ flex: '2', minWidth: 0 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 16px 0' }}>Details</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <MetaRow label="Status">
                  <StatusBadge status={item.status} />
                </MetaRow>
                <MetaRow label="Category">
                  <CategoryBadge category={item.category} />
                </MetaRow>
                <MetaRow label="Selector">
                  <span style={{ fontSize: '13px', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                    {item.selector || '—'}
                  </span>
                </MetaRow>
                <MetaRow label="URL">
                  {item.url ? (
                    <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', wordBreak: 'break-all', fontSize: '13px' }}>
                      {item.url}
                    </a>
                  ) : '—'}
                </MetaRow>
                <MetaRow label="Viewport">
                  {item.viewport_width && item.viewport_height
                    ? `${item.viewport_width} x ${item.viewport_height}`
                    : '—'}
                </MetaRow>
                <MetaRow label="User Agent">
                  <span style={{ fontSize: '12px', wordBreak: 'break-all', color: '#6b7280' }}>
                    {item.user_agent || '—'}
                  </span>
                </MetaRow>
                <MetaRow label="Created">
                  {formatDate(item.created_at)}
                </MetaRow>
                <MetaRow label="Updated">
                  {formatDate(item.updated_at)}
                </MetaRow>
                <MetaRow label="Author">
                  {item.created_by || '—'}
                </MetaRow>
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '16px', backgroundColor: '#fff', borderRadius: '8px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 12px 0' }}>Actions</h3>
            <StatusActions
              feedbackId={id}
              currentStatus={item.status}
              onUpdateStatus={handleStatusUpdate}
              onDelete={handleDelete}
            />
          </div>

          {item.comment && (
            <div style={{ marginTop: '16px', backgroundColor: '#fff', borderRadius: '8px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 8px 0' }}>Comment</h3>
              <p style={{ margin: 0, fontSize: '14px', color: '#374151', whiteSpace: 'pre-wrap' }}>{item.comment}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
      <td style={{ padding: '8px 12px 8px 0', fontSize: '13px', fontWeight: 600, color: '#6b7280', verticalAlign: 'top', whiteSpace: 'nowrap', width: '100px' }}>
        {label}
      </td>
      <td style={{ padding: '8px 0', fontSize: '14px', color: '#374151' }}>
        {children}
      </td>
    </tr>
  );
}