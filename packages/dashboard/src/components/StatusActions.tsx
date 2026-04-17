import { useUpdateFeedbackStatus, useDeleteFeedback } from '../api/hooks.js';

interface StatusActionsProps {
  feedbackId: string;
  currentStatus: string;
  onUpdateStatus: (id: string, status: string) => void;
  onDelete: (id: string) => void;
}

export function StatusActions({ feedbackId, currentStatus, onUpdateStatus, onDelete }: StatusActionsProps) {
  const updateStatus = useUpdateFeedbackStatus();
  const deleteMutation = useDeleteFeedback();

  const handleResolve = () => {
    updateStatus.mutate(
      { id: feedbackId, status: 'resolved' },
      { onSuccess: () => onUpdateStatus(feedbackId, 'resolved') },
    );
  };

  const handleDismiss = () => {
    updateStatus.mutate(
      { id: feedbackId, status: 'dismissed' },
      { onSuccess: () => onUpdateStatus(feedbackId, 'dismissed') },
    );
  };

  const handleDelete = () => {
    if (!window.confirm('Delete this feedback item?')) return;
    deleteMutation.mutate(feedbackId, { onSuccess: () => onDelete(feedbackId) });
  };

  const isPending = updateStatus.isPending || deleteMutation.isPending;

  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      {(currentStatus === 'open' || currentStatus === 'dismissed') && (
        <button
          onClick={handleResolve}
          disabled={isPending}
          style={btnStyle('#15803d', '#dcfce7')}
        >
          Resolve
        </button>
      )}
      {currentStatus === 'open' && (
        <button
          onClick={handleDismiss}
          disabled={isPending}
          style={btnStyle('#b45309', '#fef3c7')}
        >
          Dismiss
        </button>
      )}
      {currentStatus !== 'deleted' && (
        <button
          onClick={handleDelete}
          disabled={isPending}
          style={btnStyle('#dc2626', '#fee2e2')}
        >
          Delete
        </button>
      )}
    </div>
  );
}

function btnStyle(color: string, bg: string): React.CSSProperties {
  return {
    padding: '6px 12px',
    fontSize: '13px',
    fontWeight: 600,
    borderRadius: '6px',
    border: `1px solid ${color}`,
    backgroundColor: bg,
    color,
    cursor: 'pointer',
  };
}