import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PinpointProvider, usePinpoint } from '../PinpointProvider.js';

function TestComponent() {
  const { isActive, toggle } = usePinpoint();
  return (
    <button onClick={toggle} data-testid="toggle">
      {isActive ? 'Active' : 'Inactive'}
    </button>
  );
}

describe('PinpointProvider', () => {
  it('renders children', () => {
    render(
      <PinpointProvider endpoint="https://test.dev" projectId="test">
        <div data-testid="child">Hello</div>
      </PinpointProvider>,
    );
    expect(screen.getByTestId('child')).toBeDefined();
  });

  it('starts in inactive mode', () => {
    render(
      <PinpointProvider endpoint="https://test.dev" projectId="test">
        <TestComponent />
      </PinpointProvider>,
    );
    expect(screen.getByTestId('toggle').textContent).toBe('Inactive');
  });

  it('toggles to active mode', () => {
    render(
      <PinpointProvider endpoint="https://test.dev" projectId="test">
        <TestComponent />
      </PinpointProvider>,
    );
    fireEvent.click(screen.getByTestId('toggle'));
    expect(screen.getByTestId('toggle').textContent).toBe('Active');
  });

  it('throws if usePinpoint is used outside PinpointProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<TestComponent />)).toThrow();
    spy.mockRestore();
  });
});