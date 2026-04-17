const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  open: { bg: '#dbeafe', text: '#1d4ed8' },
  resolved: { bg: '#dcfce7', text: '#15803d' },
  dismissed: { bg: '#fef3c7', text: '#b45309' },
  deleted: { bg: '#fee2e2', text: '#dc2626' },
};

export function StatusBadge({ status }: { status: string }) {
  const colors = STATUS_COLORS[status] ?? { bg: '#f3f4f6', text: '#374151' };
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '9999px',
        fontSize: '12px',
        fontWeight: 600,
        lineHeight: '18px',
        backgroundColor: colors.bg,
        color: colors.text,
      }}
    >
      {status}
    </span>
  );
}