import html2canvas from 'html2canvas-pro';

export async function captureScreenshot(
  element: HTMLElement,
): Promise<Blob | null> {
  try {
    const canvas = await html2canvas(element, {
      useCORS: true,
      allowTaint: false,
      backgroundColor: null,
      scale: window.devicePixelRatio || 1,
    });

    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob(
        (blob) => resolve(blob),
        'image/png',
        1.0,
      );
    });
  } catch (error) {
    console.error('[Feedback] Screenshot capture failed:', error);
    return null;
  }
}