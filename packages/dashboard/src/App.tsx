import { Routes, Route, Link } from 'react-router';
import { FeedbackList } from './views/FeedbackList.js';
import { FeedbackDetail } from './views/FeedbackDetail.js';
import { ProjectList } from './views/ProjectList.js';

export function App() {
  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      <nav style={{
        backgroundColor: '#1f2937',
        color: '#fff',
        padding: '12px 24px',
        display: 'flex',
        gap: '24px',
        alignItems: 'center',
      }}>
        <Link to="/" style={{ color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: '16px' }}>
          Feedback
        </Link>
        <Link to="/projects" style={{ color: '#d1d5db', textDecoration: 'none', fontSize: '14px' }}>
          Projects
        </Link>
      </nav>
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
        <Routes>
          <Route path="/" element={<FeedbackList />} />
          <Route path="/feedback/:id" element={<FeedbackDetail />} />
          <Route path="/projects" element={<ProjectList />} />
        </Routes>
      </main>
    </div>
  );
}