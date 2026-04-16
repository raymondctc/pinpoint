import { useEffect, useCallback, useState } from 'react';
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

  // Walk up from e.target to find the nearest valid element in the path.
  // This avoids selecting tiny inner elements (SVG paths, spans) or giant
  // outer containers, picking the smallest valid ancestor instead.
  const findBestTarget = useCallback(
    (e: MouseEvent): HTMLElement | null => {
      const path = e.composedPath();
      for (let i = 0; i < path.length; i++) {
        const node = path[i];
        if (!(node instanceof HTMLElement)) continue;
        if (node.tagName === 'HTML' || node.tagName === 'BODY') continue;
        if (isValidTarget(node)) return node;
      }
      return null;
    },
    [isValidTarget],
  );

  useEffect(() => {
    if (selectedElement) {
      setHighlightedElement(null);
      setHighlightRect(null);
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      const target = findBestTarget(e);
      if (!target) {
        setHighlightedElement(null);
        setHighlightRect(null);
        return;
      }
      setHighlightedElement(target);
      setHighlightRect(target.getBoundingClientRect());
    };

    const handleClick = (e: MouseEvent) => {
      if (!highlightedElement) return;
      e.preventDefault();
      e.stopPropagation();
      onElementSelect(highlightedElement);
    };

    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('click', handleClick, true);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('click', handleClick, true);
    };
  }, [findBestTarget, highlightedElement, onElementSelect, selectedElement]);

  const rect = selectedRect ?? highlightRect;
  const element = selectedElement ?? highlightedElement;

  if (!rect || !element) return null;

  return (
    <div
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
      <div
        style={{
          position: 'fixed',
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
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
          {element.tagName.toLowerCase()}
          {element.classList?.item(0)
            ? `.${element.classList.item(0)}`
            : ''}
        </div>
      </div>
    </div>
  );
}