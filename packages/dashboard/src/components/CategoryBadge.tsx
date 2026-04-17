const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  bug: { bg: '#fee2e2', text: '#dc2626' },
  suggestion: { bg: '#f3e8ff', text: '#7c3aed' },
  question: { bg: '#dbeafe', text: '#1d4ed8' },
  other: { bg: '#f3f4f6', text: '#374151' },
};

export function CategoryBadge({ category }: { category: string | null }) {
  if (!category) return null;
  const colors = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.other;
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
      {category}
    </span>
  );
}