import { useProjects } from '../api/hooks.js';
import { CreateProjectForm } from '../components/CreateProjectForm.js';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString();
}

export function ProjectList() {
  const { data, isLoading, error } = useProjects();

  if (error) {
    return (
      <div style={{ color: '#dc2626', padding: '24px' }}>
        Error loading projects: {error.message}
      </div>
    );
  }

  const projects = data?.items ?? [];

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px' }}>
        Projects {projects.length > 0 && (
          <span style={{ fontSize: '16px', fontWeight: 400, color: '#6b7280' }}>({projects.length})</span>
        )}
      </h1>

      {isLoading ? (
        <div style={{ padding: '48px', textAlign: 'center', color: '#6b7280' }}>Loading...</div>
      ) : projects.length === 0 ? (
        <div style={{ padding: '48px', textAlign: 'center', color: '#6b7280' }}>No projects yet.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px' }}>
          <thead>
            <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Slug</th>
              <th style={thStyle}>Created</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={tdStyle}>{project.name}</td>
                <td style={tdStyle}><code style={{ fontSize: '13px', backgroundColor: '#f3f4f6', padding: '2px 6px', borderRadius: '4px' }}>{project.slug}</code></td>
                <td style={tdStyle}>{formatDate(project.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ marginTop: '32px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>Create New Project</h2>
        <CreateProjectForm />
      </div>
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