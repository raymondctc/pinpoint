import { useState } from 'react';
import { getScreenshotUrl } from '../api/client.js';

interface ScreenshotViewerProps {
  feedbackId: string;
}

export function ScreenshotViewer({ feedbackId }: ScreenshotViewerProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div style={{
        width: '100%',
        aspectRatio: '16 / 9',
        maxWidth: '100%',
        borderRadius: '8px',
        backgroundColor: '#e5e7eb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#6b7280',
        fontSize: '14px',
      }}>
        Screenshot unavailable
      </div>
    );
  }

  return (
    <img
      src={getScreenshotUrl(feedbackId)}
      alt="Feedback screenshot"
      onError={() => setFailed(true)}
      style={{
        maxWidth: '100%',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
      }}
    />
  );
}