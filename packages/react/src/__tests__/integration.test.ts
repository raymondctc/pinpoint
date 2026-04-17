import { describe, it, expect } from 'vitest';
import {
  validateFeedbackMetadata,
  validateComment,
  validateDOMSnapshot,
  DEFAULT_CATEGORIES,
  COMPUTED_STYLES_WHITELIST,
  MAX_COMMENT_LENGTH,
} from '@pinpoint/shared';

describe('package integration', () => {
  it('shared validators work with react types', () => {
    const comment = validateComment('Test feedback');
    expect(comment.valid).toBe(true);

    const metadata = validateFeedbackMetadata({
      projectId: 'test',
      comment: 'Test feedback',
      category: 'bug',
      selector: '.btn',
      url: 'https://example.com',
      viewportWidth: 1920,
      viewportHeight: 1080,
      userAgent: 'TestAgent/1.0',
      captureMethod: 'html2canvas',
    });

    expect(metadata.valid).toBe(true);
  });

  it('constants are consistent across packages', () => {
    expect(DEFAULT_CATEGORIES).toContain('bug');
    expect(COMPUTED_STYLES_WHITELIST).toContain('display');
    expect(MAX_COMMENT_LENGTH).toBe(2000);
  });
});