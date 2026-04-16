import { createContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { FeedbackProviderConfig, DOMSnapshotNode } from '@feedback/shared';
import { DEFAULT_CATEGORIES } from '@feedback/shared';
import { HighlightOverlay } from './HighlightOverlay.js';
import { CommentPopover } from './CommentPopover.js';
import { isDarkMode } from './CommentPopover.js';

export interface FeedbackContextValue {
  isActive: boolean;
  toggle: () => void;
  config: FeedbackProviderConfig;
}

export const FeedbackContext = createContext<FeedbackContextValue | null>(null);

interface CapturedData {
  screenshot: Blob | null;
  domSnapshot: DOMSnapshotNode;
  element: HTMLElement;
}

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
  const [capturedData, setCapturedData] = useState<CapturedData | null>(null);
  const dark = isDarkMode();

  // Set cursor to crosshair when feedback mode is active
  useEffect(() => {
    if (isActive) {
      document.body.style.cursor = 'crosshair';
      return () => {
        document.body.style.cursor = '';
      };
    }
  }, [isActive]);

  // ESC: first press clears selection (back to hover), second press exits feedback mode
  useEffect(() => {
    if (!isActive) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedElement) {
          setSelectedElement(null);
          setSelectedRect(null);
          setCapturedData(null);
        } else {
          setIsActive(false);
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isActive, selectedElement]);

  const toggle = useCallback(() => {
    setIsActive((prev) => !prev);
    setSelectedElement(null);
    setSelectedRect(null);
    setCapturedData(null);
  }, []);

  const config: FeedbackProviderConfig = {
    endpoint,
    projectId,
    categories: (categories as FeedbackProviderConfig['categories']) ?? DEFAULT_CATEGORIES,
    captureMethod,
    theme,
    exclude,
  };

  const handleElementSelect = useCallback(async (element: HTMLElement) => {
    setSelectedElement(element);
    setSelectedRect(element.getBoundingClientRect());

    // Capture screenshot and DOM snapshot immediately while the element
    // is still in its current visual state (e.g. an open menu won't have
    // closed yet because we haven't yielded to the browser).
    try {
      const { captureScreenshot } = await import('./ScreenshotCapture.js');
      const { serializeDOM } = await import('./DOMSerializer.js');
      const [screenshot, domSnapshot] = await Promise.all([
        captureScreenshot(element),
        Promise.resolve(serializeDOM(element)),
      ]);
      setCapturedData({ screenshot, domSnapshot, element });
    } catch (error) {
      console.error('[Feedback] Capture failed on selection:', error);
      setCapturedData(null);
    }
  }, []);

  const handleCancel = useCallback(() => {
    setSelectedElement(null);
    setSelectedRect(null);
    setCapturedData(null);
  }, []);

  const handleSubmit = useCallback(async (comment: string, category: string) => {
    if (!capturedData) return;

    setIsSubmitting(true);

    try {
      const { submitFeedback } = await import('./FeedbackSubmitter.js');
      const { validateFeedbackMetadata, validateDOMSnapshot } = await import('@feedback/shared');

      const metadata = validateFeedbackMetadata({
        projectId: config.projectId,
        comment,
        category,
        selector: capturedData.element.tagName.toLowerCase(),
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

      const snapshotValidation = validateDOMSnapshot(capturedData.domSnapshot);
      if (!snapshotValidation.valid) {
        console.error('[Feedback] Invalid snapshot:', snapshotValidation.error);
        return;
      }

      const result = await submitFeedback({
        endpoint: config.endpoint,
        metadata: metadata.data,
        screenshot: capturedData.screenshot,
        domSnapshot: snapshotValidation.data,
      });

      if (result.success) {
        console.log('[Feedback] Submitted:', result.id);
      } else {
        console.error('[Feedback] Submit failed:', result.error);
      }
    } catch (error) {
      console.error('[Feedback] Submit error:', error);
    } finally {
      setIsSubmitting(false);
      setSelectedElement(null);
      setSelectedRect(null);
      setCapturedData(null);
    }
  }, [capturedData, config]);

  return (
    <FeedbackContext.Provider value={{ isActive, toggle, config }}>
      {children}
      {isActive && (
        <>
          {isSubmitting && (
            <div data-feedback-overlay="" style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: dark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.3)', zIndex: 999999,
            }}>
              <div style={{
                backgroundColor: dark ? '#1c1c1e' : '#fff',
                color: dark ? '#f5f5f7' : '#111827',
                border: `1px solid ${dark ? '#3a3a3c' : '#e5e7eb'}`,
                padding: '16px 24px',
                borderRadius: '8px', fontFamily: 'system-ui, sans-serif',
                fontSize: '14px',
                boxShadow: dark ? '0 4px 16px rgba(0,0,0,0.6)' : '0 4px 12px rgba(0,0,0,0.15)',
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