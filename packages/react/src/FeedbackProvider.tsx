import { createContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { FeedbackProviderConfig } from '@feedback/shared';
import { DEFAULT_CATEGORIES } from '@feedback/shared';
import { HighlightOverlay } from './HighlightOverlay.js';
import { CommentPopover } from './CommentPopover.js';

export interface FeedbackContextValue {
  isActive: boolean;
  toggle: () => void;
  config: FeedbackProviderConfig;
}

export const FeedbackContext = createContext<FeedbackContextValue | null>(null);

interface FeedbackProviderProps {
  endpoint: string;
  projectId: string;
  categories?: string[];
  captureMethod?: 'html2canvas' | 'native';
  theme?: 'light' | 'dark' | 'auto';
  exclude?: string[];
  children: ReactNode;
}

export function FeedbackProvider({
  endpoint,
  projectId,
  categories,
  captureMethod = 'html2canvas',
  theme = 'auto',
  exclude,
  children,
}: FeedbackProviderProps) {
  const [isActive, setIsActive] = useState(false);
  const [selectedElement, setSelectedElement] = useState<HTMLElement | null>(null);
  const [selectedRect, setSelectedRect] = useState<DOMRect | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Set cursor to crosshair when feedback mode is active
  useEffect(() => {
    if (isActive) {
      document.body.style.cursor = 'crosshair';
      return () => {
        document.body.style.cursor = '';
      };
    }
  }, [isActive]);

  // ESC to exit feedback mode
  useEffect(() => {
    if (!isActive) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsActive(false);
        setSelectedElement(null);
        setSelectedRect(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isActive]);

  const toggle = useCallback(() => {
    setIsActive((prev) => !prev);
    setSelectedElement(null);
    setSelectedRect(null);
  }, []);

  const config: FeedbackProviderConfig = {
    endpoint,
    projectId,
    categories: (categories as FeedbackProviderConfig['categories']) ?? DEFAULT_CATEGORIES,
    captureMethod,
    theme,
    exclude,
  };

  const handleElementSelect = useCallback((element: HTMLElement) => {
    setSelectedElement(element);
    setSelectedRect(element.getBoundingClientRect());
  }, []);

  const handleCancel = useCallback(() => {
    setSelectedElement(null);
    setSelectedRect(null);
  }, []);

  const handleSubmit = useCallback(async (comment: string, category: string) => {
    if (!selectedElement) return;

    const element = selectedElement;

    // Temporarily clear selection to hide overlay, show submitting state
    setSelectedElement(null);
    setSelectedRect(null);
    setIsSubmitting(true);

    // Wait for repaint
    await new Promise((resolve) => requestAnimationFrame(resolve));

    try {
      const { captureScreenshot } = await import('./ScreenshotCapture.js');
      const { serializeDOM } = await import('./DOMSerializer.js');
      const { submitFeedback } = await import('./FeedbackSubmitter.js');
      const { validateFeedbackMetadata, validateDOMSnapshot } = await import('@feedback/shared');

      const screenshot = await captureScreenshot(element);
      const domSnapshot = serializeDOM(element);

      const metadata = validateFeedbackMetadata({
        projectId: config.projectId,
        comment,
        category,
        selector: element.tagName.toLowerCase(),
        url: window.location.href,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        userAgent: navigator.userAgent,
        captureMethod: config.captureMethod ?? 'html2canvas',
      });

      if (!metadata.valid) {
        console.error('[Feedback] Invalid metadata:', metadata.error);
        return;
      }

      const snapshotValidation = validateDOMSnapshot(domSnapshot);
      if (!snapshotValidation.valid) {
        console.error('[Feedback] Invalid snapshot:', snapshotValidation.error);
        return;
      }

      const result = await submitFeedback({
        endpoint: config.endpoint,
        metadata: metadata.data,
        screenshot,
        domSnapshot: snapshotValidation.data,
      });

      if (result.success) {
        console.log('[Feedback] Submitted:', result.id);
      } else {
        console.error('[Feedback] Submit failed:', result.error);
      }
    } catch (error) {
      console.error('[Feedback] Capture/submit error:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedElement, config]);

  return (
    <FeedbackContext.Provider value={{ isActive, toggle, config }}>
      {children}
      {isActive && (
        <>
          {isSubmitting && (
            <div data-feedback-overlay="" style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 999999,
            }}>
              <div style={{
                backgroundColor: '#fff', padding: '16px 24px',
                borderRadius: '8px', fontFamily: 'system-ui, sans-serif',
                fontSize: '14px',
              }}>
                Submitting feedback...
              </div>
            </div>
          )}
          {!isSubmitting && <HighlightOverlay config={config} onElementSelect={handleElementSelect} selectedElement={selectedElement} selectedRect={selectedRect} />}
          {!isSubmitting && selectedElement && selectedRect && (
            <CommentPopover
              anchorRect={selectedRect}
              categories={config.categories ?? DEFAULT_CATEGORIES}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
            />
          )}
        </>
      )}
    </FeedbackContext.Provider>
  );
}

export { useFeedback } from './useFeedback.js';