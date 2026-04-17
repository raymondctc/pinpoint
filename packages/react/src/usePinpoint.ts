import { useContext } from 'react';
import { PinpointContext } from './PinpointProvider.js';

export function usePinpoint() {
  const context = useContext(PinpointContext);
  if (!context) {
    throw new Error('usePinpoint must be used within a PinpointProvider');
  }
  return context;
}