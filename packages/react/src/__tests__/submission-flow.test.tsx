import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PinpointProvider, usePinpoint } from '../PinpointProvider.js';

vi.mock('html2canvas-pro', () => ({
  default: vi.fn().mockResolvedValue({
    toBlob: (cb: (blob: Blob | null) => void) => {
      cb(new Blob(['fake-png'], { type: 'image/png' }));
    },
  }),
}));

const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
  new Response(JSON.stringify({ id: 'test-id' }), { status: 201 }),
);

function TestApp() {
  const { isActive, toggle } = usePinpoint();
  return (
    <div>
      <button onClick={toggle} data-testid="toggle">
        {isActive ? 'Active' : 'Inactive'}
      </button>
      <div data-testid="clickable" style={{ width: 100, height: 100 }}>
        Click me
      </div>
    </div>
  );
}

describe('submission flow', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it('activates feedback mode on toggle', async () => {
    render(
      <PinpointProvider endpoint="https://test.dev/api/v1/feedback" projectId="test">
        <TestApp />
      </PinpointProvider>,
    );

    expect(screen.getByTestId('toggle').textContent).toBe('Inactive');

    fireEvent.click(screen.getByTestId('toggle'));
    expect(screen.getByTestId('toggle').textContent).toBe('Active');

    fireEvent.click(screen.getByTestId('toggle'));
    expect(screen.getByTestId('toggle').textContent).toBe('Inactive');
  });
});