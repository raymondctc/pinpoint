import html2canvas from 'html2canvas-pro';

/**
 * Resolve the effective background colour of a page by walking up from
 * the root element. Returns the first non-transparent colour found, or
 * null as a sentinel for html2canvas ("use transparent").
 */
function resolvePageBackground(): string | null {
  for (const el of [document.documentElement, document.body]) {
    const bg = window.getComputedStyle(el).backgroundColor;
    // "transparent", "rgba(0,0,0,0)", and empty all mean "nothing painted here"
    if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') {
      return bg;
    }
  }
  return null;
}

export async function captureScreenshot(
  _element: HTMLElement,
): Promise<Blob | null> {
  try {
    // Always capture the full page so that the actual theme background
    // (dark or light) is included.  When we only captured the clicked
    // element, elements that visually inherit their background from
    // <html>/<body> would render with a white/grey canvas because their
    // own background-color was "transparent".
    const target = document.body;

    // Compute the rendered page background and pass it to html2canvas so
    // that even if both <html> and <body> report "transparent",
    // html2canvas won't fall back to its default white fill.
    const bgColor = resolvePageBackground();

    const canvas = await html2canvas(target, {
      useCORS: true,
      allowTaint: false,
      backgroundColor: bgColor ?? undefined,
      scale: window.devicePixelRatio || 1,
      windowWidth: document.documentElement.scrollWidth,
      windowHeight: document.documentElement.scrollHeight,
    });

    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob(
        (blob) => resolve(blob),
        'image/png',
        1.0,
      );
    });
  } catch (error) {
    console.error('[Pinpoint] Screenshot capture failed:', error);
    return null;
  }
}