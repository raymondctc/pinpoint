import { useEffect, useCallback, useState, useRef } from 'react';
import type { PinpointProviderConfig } from '@pinpoint/shared';
import { MIN_ELEMENT_SIZE } from '@pinpoint/shared';

interface HighlightOverlayProps {
  config: PinpointProviderConfig;
  onElementSelect: (element: HTMLElement) => void;
  selectedElement?: HTMLElement | null;
  selectedRect?: DOMRect | null;
}

const HINT_KEY = 'pinpoint-hint-shown';

export function HighlightOverlay({ config, onElementSelect, selectedElement, selectedRect }: HighlightOverlayProps) {
  const [highlightedElement, setHighlightedElement] = useState<HTMLElement | null>(null);
  const [ancestorStack, setAncestorStack] = useState<HTMLElement[]>([]);
  const [ancestorLevel, setAncestorLevel] = useState(0);
  const [showHint, setShowHint] = useState(false);

  // Refs for access inside event handlers (avoid stale closures)
  const ancestorStackRef = useRef<HTMLElement[]>([]);
  const ancestorLevelRef = useRef(0);
  const onElementSelectRef = useRef(onElementSelect);
  const hintShownRef = useRef(false);

  // Keep refs in sync with state
  useEffect(() => { ancestorStackRef.current = ancestorStack; }, [ancestorStack]);
  useEffect(() => { ancestorLevelRef.current = ancestorLevel; }, [ancestorLevel]);
  useEffect(() => { onElementSelectRef.current = onElementSelect; }, [onElementSelect]);

  const isExcluded = useCallback(
    (element: HTMLElement): boolean => {
      if (element.closest('[data-pinpoint-overlay]')) return true;
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

  // Build ancestor stack from deepest valid element upward: [deepest, parent, grandparent, ...]
  const buildAncestorStack = useCallback(
    (element: HTMLElement): HTMLElement[] => {
      const stack: HTMLElement[] = [];
      let current: HTMLElement | null = element;
      while (current && current.tagName !== 'HTML' && current.tagName !== 'BODY') {
        if (isValidTarget(current)) {
          stack.push(current);
        }
        current = current.parentElement;
      }
      return stack;
    },
    [isValidTarget],
  );

  const findBestTarget = useCallback(
    (e: MouseEvent): HTMLElement | null => {
      const path = e.composedPath();
      for (let i = 0; i < path.length; i++) {
        const node = path[i];
        if (!(node instanceof HTMLElement)) continue;
        if (node.tagName === 'HTML' || node.tagName === 'BODY') continue;
        if (isValidTarget(node)) return node;
      }
      const stack = document.elementsFromPoint(e.clientX, e.clientY);
      for (const node of stack) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.tagName === 'HTML' || node.tagName === 'BODY') continue;
        if (isValidTarget(node)) return node;
      }
      return null;
    },
    [isValidTarget],
  );

  // Show first-use hint once per browser
  useEffect(() => {
    if (selectedElement || hintShownRef.current) {
      setShowHint(false);
      return;
    }
    if (highlightedElement && !hintShownRef.current) {
      try {
        if (!localStorage.getItem(HINT_KEY)) {
          hintShownRef.current = true;
          localStorage.setItem(HINT_KEY, 'true');
          setShowHint(true);
          const timer = setTimeout(() => setShowHint(false), 3000);
          return () => clearTimeout(timer);
        }
      } catch {
        // localStorage not available
      }
      hintShownRef.current = true;
    }
  }, [highlightedElement, selectedElement]);

  // Reset ancestor state when element is selected
  useEffect(() => {
    if (selectedElement) {
      setAncestorStack([]);
      setAncestorLevel(0);
      setHighlightedElement(null);
    }
  }, [selectedElement]);

  // Main event handler effect
  useEffect(() => {
    if (selectedElement) return;

    const lastDeepestRef = { current: null as HTMLElement | null };

    const handleMouseMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target && target.closest('[data-pinpoint-overlay]')) return;

      const best = findBestTarget(e);
      if (!best) {
        setHighlightedElement(null);
        setAncestorStack([]);
        setAncestorLevel(0);
        // Sync refs immediately so subsequent event handlers see current values
        ancestorStackRef.current = [];
        ancestorLevelRef.current = 0;
        lastDeepestRef.current = null;
        return;
      }

      const newStack = buildAncestorStack(best);

      // Behavior C: sticky within same subtree
      // Keep ancestor level as long as the new deepest element is within
      // the currently highlighted subtree; reset when moving to a different branch.
      if (best !== lastDeepestRef.current) {
        const currentStack = ancestorStackRef.current;
        const currentLevel = ancestorLevelRef.current;
        const currentAncestor = currentStack[currentLevel];

        if (currentLevel > 0 && currentAncestor && currentAncestor.contains(best)) {
          // Still within the same subtree — maintain the ancestor level
          const newIndex = newStack.indexOf(currentAncestor);
          if (newIndex !== -1) {
            setAncestorStack(newStack);
            setAncestorLevel(newIndex);
            // Sync refs immediately so subsequent event handlers see current values
            ancestorStackRef.current = newStack;
            ancestorLevelRef.current = newIndex;
          } else {
            // Current ancestor not in new stack (e.g. excluded), reset to deepest
            setAncestorStack(newStack);
            setAncestorLevel(0);
            ancestorStackRef.current = newStack;
            ancestorLevelRef.current = 0;
          }
        } else {
          // Different subtree entirely, reset to deepest
          setAncestorStack(newStack);
          setAncestorLevel(0);
          ancestorStackRef.current = newStack;
          ancestorLevelRef.current = 0;
        }
        lastDeepestRef.current = best;
      }

      setHighlightedElement(best);
    };

    // Any click on the highlighted element selects it (no border-only restriction)
    const handleClick = (e: MouseEvent) => {
      // Don't intercept clicks on overlay UI (arrow buttons, etc.)
      const target = e.target as HTMLElement;
      if (target && target.closest('[data-pinpoint-overlay]')) return;

      const stack = ancestorStackRef.current;
      const level = ancestorLevelRef.current;
      const elementToSelect = stack[level];

      if (!elementToSelect) return;

      e.preventDefault();
      e.stopPropagation();
      onElementSelectRef.current(elementToSelect);
    };

    // Keyboard navigation: ↑/↓ cycle ancestors, Enter confirms selection
    const handleKeyDown = (e: KeyboardEvent) => {
      const stack = ancestorStackRef.current;
      if (stack.length === 0) return;

      const level = ancestorLevelRef.current;

      if (e.key === 'ArrowUp') {
        if (level < stack.length - 1) {
          e.preventDefault();
          const newLevel = level + 1;
          setAncestorLevel(newLevel);
          ancestorLevelRef.current = newLevel;
        }
      } else if (e.key === 'ArrowDown') {
        if (level > 0) {
          e.preventDefault();
          const newLevel = level - 1;
          setAncestorLevel(newLevel);
          ancestorLevelRef.current = newLevel;
        }
      } else if (e.key === 'Enter') {
        const element = stack[level];
        if (element) {
          e.preventDefault();
          onElementSelectRef.current(element);
        }
      }
    };

    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [findBestTarget, buildAncestorStack, selectedElement]);

  // Compute the currently displayed element and rect
  // ancestorStack[ancestorLevel] is the effective element (or deepest if no stack)
  const effectiveElement = ancestorStack.length > 0
    ? ancestorStack[ancestorLevel]
    : highlightedElement;

  // Compute rect from the element for hover mode; use selectedRect for selection mode
  const effectiveRect = effectiveElement?.getBoundingClientRect() ?? null;
  const rect = selectedRect ?? effectiveRect;
  const element = selectedElement ?? effectiveElement;

  // Navigation arrows visible only in hover mode (not after selection)
  const showNavigation = !selectedElement && ancestorStack.length > 0;

  if (!rect || !element) return null;

  const isAtDeepest = ancestorLevel <= 0;
  const isAtRoot = ancestorLevel >= ancestorStack.length - 1;

  const borderColor = selectedRect ? '#16a34a' : '#3b82f6';
  const bgColor = selectedRect ? '#16a34a' : '#3b82f6';

  return (
    <div
      data-pinpoint-overlay=""
      data-testid="pinpoint-overlay"
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
          border: `3px solid ${borderColor}`,
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
            backgroundColor: bgColor,
            color: '#fff',
            padding: '2px 6px',
            borderRadius: '3px',
            whiteSpace: 'nowrap',
            pointerEvents: showNavigation ? 'auto' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
          }}
        >
          {showNavigation && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setAncestorLevel((prev) => Math.min(prev + 1, ancestorStack.length - 1));
              }}
              disabled={isAtRoot}
              style={{
                background: 'none',
                border: 'none',
                color: isAtRoot ? 'rgba(255,255,255,0.3)' : '#fff',
                cursor: isAtRoot ? 'default' : 'pointer',
                padding: '0 2px',
                fontSize: '11px',
                lineHeight: '1',
              }}
              aria-label="Select parent element"
              data-pinpoint-overlay=""
            >
              ↑
            </button>
          )}
          <span>
            {element.tagName.toLowerCase()}
            {element.classList?.item(0) ? `.${element.classList.item(0)}` : ''}
          </span>
          {showNavigation && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setAncestorLevel((prev) => Math.max(prev - 1, 0));
              }}
              disabled={isAtDeepest}
              style={{
                background: 'none',
                border: 'none',
                color: isAtDeepest ? 'rgba(255,255,255,0.3)' : '#fff',
                cursor: isAtDeepest ? 'default' : 'pointer',
                padding: '0 2px',
                fontSize: '11px',
                lineHeight: '1',
              }}
              aria-label="Select child element"
              data-pinpoint-overlay=""
            >
              ↓
            </button>
          )}
        </div>
      </div>
      {showHint && !selectedRect && rect && (
        <div
          style={{
            position: 'fixed',
            top: Math.max(rect.top - 44, 4),
            left: rect.left,
            fontSize: '11px',
            fontFamily: 'system-ui, sans-serif',
            backgroundColor: 'rgba(0,0,0,0.75)',
            color: '#fff',
            padding: '4px 8px',
            borderRadius: '3px',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 999999,
          }}
        >
          Use ↑↓ keys to change level
        </div>
      )}
    </div>
  );
}