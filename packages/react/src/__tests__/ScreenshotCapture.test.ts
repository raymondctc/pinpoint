import { describe, it, expect, vi } from 'vitest';
import { captureScreenshot } from '../ScreenshotCapture.js';

vi.mock('html2canvas-pro', () => ({
  default: vi.fn().mockResolvedValue({
    toBlob: (cb: (blob: Blob | null) => void) => {
      cb(new Blob(['fake-png'], { type: 'image/png' }));
    },
  }),
}));

describe('captureScreenshot', () => {
  it('returns a PNG blob on success', async () => {
    const element = document.createElement('div');
    document.body.appendChild(element);

    const result = await captureScreenshot(element);

    expect(result).toBeDefined();
    expect(result!.type).toBe('image/png');

    element.remove();
  });

  it('returns null when html2canvas-pro throws', async () => {
    const { default: html2canvas } = await import('html2canvas-pro');
    (html2canvas as any).mockRejectedValueOnce(new Error('render failed'));

    const element = document.createElement('div');
    document.body.appendChild(element);

    const result = await captureScreenshot(element);

    expect(result).toBeNull();

    element.remove();
  });

  it('captures document.body instead of the clicked element', async () => {
    const { default: html2canvas } = await import('html2canvas-pro');
    const element = document.createElement('div');
    document.body.appendChild(element);

    await captureScreenshot(element);

    // Should be called with document.body, not the passed element
    expect(html2canvas).toHaveBeenCalledWith(document.body, expect.objectContaining({
      useCORS: true,
    }));

    element.remove();
  });

  it('uses resolved page background instead of null', async () => {
    const { default: html2canvas } = await import('html2canvas-pro');
    const element = document.createElement('div');
    document.body.appendChild(element);

    await captureScreenshot(element);

    // backgroundColor should be a computed value (string) or undefined, never null
    const callArgs = (html2canvas as any).mock.calls.at(-1);
    const options = callArgs[1];
    expect(options.backgroundColor).not.toBe(null);

    element.remove();
  });

  it('includes windowWidth and windowHeight for full-page capture', async () => {
    const { default: html2canvas } = await import('html2canvas-pro');
    const element = document.createElement('div');
    document.body.appendChild(element);

    await captureScreenshot(element);

    expect(html2canvas).toHaveBeenCalledWith(document.body, expect.objectContaining({
      windowWidth: expect.any(Number),
      windowHeight: expect.any(Number),
    }));

    element.remove();
  });
});