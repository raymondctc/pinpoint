import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HighlightOverlay } from '../HighlightOverlay.js';
import type { FeedbackProviderConfig } from '@feedback/shared';

const defaultConfig: FeedbackProviderConfig = {
  endpoint: 'https://test.dev/api/v1/feedback',
  projectId: 'test',
  categories: ['bug', 'suggestion', 'question', 'other'],
  captureMethod: 'html2canvas',
  theme: 'auto',
  exclude: undefined,
};

describe('HighlightOverlay', () => {
  it('renders overlay when an element is selected', () => {
    const element = document.createElement('div');
    element.classList.add('my-class');
    const rect = new DOMRect(10, 20, 200, 100);

    render(
      <HighlightOverlay
        config={defaultConfig}
        onElementSelect={vi.fn()}
        selectedElement={element}
        selectedRect={rect}
      />,
    );

    const overlay = screen.getByTestId('feedback-overlay');
    expect(overlay).toBeDefined();
    expect(overlay.textContent).toContain('div.my-class');
  });

  it('renders nothing when no element is highlighted or selected', () => {
    render(
      <HighlightOverlay
        config={defaultConfig}
        onElementSelect={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('feedback-overlay')).toBeNull();
  });

  it('does not show Select button when element is selected', () => {
    const element = document.createElement('div');
    const rect = new DOMRect(10, 20, 200, 100);

    render(
      <HighlightOverlay
        config={defaultConfig}
        onElementSelect={vi.fn()}
        selectedElement={element}
        selectedRect={rect}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Select' })).toBeNull();
  });

  it('shows green border for selected elements', () => {
    const element = document.createElement('span');
    const rect = new DOMRect(50, 60, 300, 150);

    render(
      <HighlightOverlay
        config={defaultConfig}
        onElementSelect={vi.fn()}
        selectedElement={element}
        selectedRect={rect}
      />,
    );

    const overlay = screen.getByTestId('feedback-overlay');
    expect(overlay.textContent).toContain('span');
    // Selected state should use green border
    expect(overlay.innerHTML).toContain('rgb(22, 163, 74)');
  });
});