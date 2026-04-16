import { useEffect, useCallback, useRef, useState } from 'react';
import type { FeedbackProviderConfig } from '@feedback/shared';
import { MIN_ELEMENT_SIZE } from '@feedback/shared';

interface HighlightOverlayProps {
  config: FeedbackProviderConfig;
  onElementSelect: (element: HTMLElement) => void;
  selectedElement?: HTMLElement | null;
  selectedRect?: DOMRect | null;
}

export function HighlightOverlay({ config, onElementSelect, selectedElement, selectedRect }: HighlightOverlayProps) {
  const [highlightedElement, setHighlightedElement] = useState<HTMLElement | null>(null);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const isExcluded = useCallback(
    (element: HTMLElement): boolean => {
      if (element.closest('[data-feedback-overlay]')) return true;
      if (!config.exclude) return false;
      return config.exclude.some((selector) => element.matches(selector));
    },
    [config.exclude],
  );

  const isValidTarget = useCallback(
    (element: HTMLElement): boolean => {
      if (isExcluded(element)) return false;
      const rect = element.getBoundingClientRect();
      if (rect.width < MIN_ELEMENT_SIZE || rect.height < MIN_ELEMENT_SIZE) return false;
      const style = window.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      return true;
    },
    [isExcluded],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target || !isValidTarget(target)) {
        setHighlightedElement(null);
        setHighlightRect(null);
        return;
      }
      setHighlightedElement(target);
      setHighlightRect(target.getBoundingClientRect());
    },
    [isValidTarget],
  );

  const handleClick = useCallback(
    (e: MouseEvent) => {
      if (!highlightedElement) return;
      e.preventDefault();
      e.stopPropagation();
      onElementSelect(highlightedElement);
    },
    [highlightedElement, onElementSelect],
  );

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('click', handleClick, true);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('click', handleClick, true);
    };
  }, [handleMouseMove, handleClick]);

  return (
    <div
      ref={overlayRef}
      data-feedback-overlay=""
      data-testid="feedback-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: 0,
        height: 0,
        pointerEvents: 'none',
        zIndex: 999998,
      }}
    >
      {(selectedRect || highlightRect) && (
        <div
          style={{
            position: 'fixed',
            top: (selectedRect ?? highlightRect)!.top,
            left: (selectedRect ?? highlightRect)!.left,
            width: (selectedRect ?? highlightRect)!.width,
            height: (selectedRect ?? highlightRect)!.height,
            border: `3px solid ${selectedRect ? '#16a34a' : '#3b82f6'}`,
            borderRadius: '4px',
            pointerEvents: 'none',
            transition: 'all 0.1s ease-out',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '-24px',
              left: 0,
              fontSize: '11px',
              fontFamily: 'monospace',
              backgroundColor: selectedRect ? '#16a34a' : '#3b82f6',
              color: '#fff',
              padding: '2px 6px',
              borderRadius: '3px',
              whiteSpace: 'nowrap',
            }}
          >
            {(selectedElement ?? highlightedElement)?.tagName.toLowerCase()}
            {(selectedElement ?? highlightedElement)?.classList?.item(0)
              ? `.${(selectedElement ?? highlightedElement)!.classList.item(0)}`
              : ''}
          </div>
        </div>
      )}
    </div>
  );
}