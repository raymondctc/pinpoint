import { useProjects } from '../api/hooks.js';
import type { FeedbackListParams } from '../api/client.js';

const STATUSES = ['', 'open', 'resolved', 'dismissed', 'deleted'] as const;
const CATEGORIES = ['', 'bug', 'suggestion', 'question', 'other'] as const;

interface FilterBarProps {
  filters: FeedbackListParams;
  onChange: (filters: FeedbackListParams) => void;
}

const selectStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: '6px',
  border: '1px solid #d1d5db',
  fontSize: '14px',
  backgroundColor: '#fff',
};

export function FilterBar({ filters, onChange }: FilterBarProps) {
  const { data: projectsData } = useProjects();
  const projects = projectsData?.items ?? [];

  const handleChange = (patch: Partial<FeedbackListParams>) => {
    onChange({ ...filters, ...patch });
  };

  return (
    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
      <select
        style={selectStyle}
        value={filters.projectId ?? ''}
        onChange={(e) => handleChange({ projectId: e.target.value || undefined })}
      >
        <option value="">All Projects</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      <select
        style={selectStyle}
        value={filters.status ?? ''}
        onChange={(e) => handleChange({ status: e.target.value || undefined })}
      >
        <option value="">All Statuses</option>
        {STATUSES.map((s) =>
          s ? (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ) : null,
        )}
      </select>

      <select
        style={selectStyle}
        value={filters.category ?? ''}
        onChange={(e) => handleChange({ category: e.target.value || undefined })}
      >
        <option value="">All Categories</option>
        {CATEGORIES.map((c) =>
          c ? (
            <option key={c} value={c}>
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </option>
          ) : null,
        )}
      </select>
    </div>
  );
}