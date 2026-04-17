import { useState } from 'react';
import { useCreateProject } from '../api/hooks.js';

export function CreateProjectForm() {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const createProject = useCreateProject();

  const generateSlug = (value: string) => {
    return value
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slugEdited) {
      setSlug(generateSlug(value));
    }
  };

  const handleSlugChange = (value: string) => {
    setSlugEdited(true);
    setSlug(value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !slug.trim()) {
      setError('Name and slug are required.');
      return;
    }

    createProject.mutate(
      { name: name.trim(), slug: slug.trim() },
      {
        onSuccess: () => {
          setName('');
          setSlug('');
          setSlugEdited(false);
          setError(null);
        },
        onError: (err) => {
          if ((err as Error).message.includes('409') || (err as Error).message.includes('duplicate')) {
            setError('A project with this slug already exists.');
          } else {
            setError(err.message ?? 'Failed to create project.');
          }
        },
      },
    );
  };

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    fontSize: '14px',
    width: '100%',
    boxSizing: 'border-box',
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '400px' }}>
      <div>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
          Project Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="My Project"
          style={inputStyle}
        />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
          Slug
        </label>
        <input
          type="text"
          value={slug}
          onChange={(e) => handleSlugChange(e.target.value)}
          placeholder="my-project"
          style={inputStyle}
        />
      </div>
      {error && (
        <div style={{ color: '#dc2626', fontSize: '13px' }}>{error}</div>
      )}
      <button
        type="submit"
        disabled={createProject.isPending}
        style={{
          padding: '8px 16px',
          fontSize: '14px',
          fontWeight: 600,
          borderRadius: '6px',
          border: 'none',
          backgroundColor: '#2563eb',
          color: '#fff',
          cursor: createProject.isPending ? 'not-allowed' : 'pointer',
          opacity: createProject.isPending ? 0.6 : 1,
          alignSelf: 'flex-start',
        }}
      >
        {createProject.isPending ? 'Creating...' : 'Create Project'}
      </button>
    </form>
  );
}