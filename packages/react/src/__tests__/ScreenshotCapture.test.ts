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

  it('passes useCORS and backgroundColor options to html2canvas-pro', async () => {
    const { default: html2canvas } = await import('html2canvas-pro');
    const element = document.createElement('div');
    document.body.appendChild(element);

    await captureScreenshot(element);

    expect(html2canvas).toHaveBeenCalledWith(element, expect.objectContaining({
      useCORS: true,
      backgroundColor: null,
    }));

    element.remove();
  });
});