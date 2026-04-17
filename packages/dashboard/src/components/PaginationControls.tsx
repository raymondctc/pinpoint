interface PaginationControlsProps {
  cursor: string | null;
  onLoadMore: (cursor: string) => void;
  isLoading: boolean;
}

export function PaginationControls({ cursor, onLoadMore, isLoading }: PaginationControlsProps) {
  if (!cursor) return null;

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
      <button
        onClick={() => onLoadMore(cursor)}
        disabled={isLoading}
        style={{
          padding: '8px 20px',
          borderRadius: '6px',
          border: '1px solid #d1d5db',
          backgroundColor: '#fff',
          fontSize: '14px',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          opacity: isLoading ? 0.6 : 1,
        }}
      >
        {isLoading ? 'Loading...' : 'Load more'}
      </button>
    </div>
  );
}