import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { serializeDOM } from '../DOMSerializer.js';
import { COMPUTED_STYLES_WHITELIST, MAX_DOM_DEPTH } from '@pinpoint/shared';

describe('serializeDOM', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('serializes a simple element', () => {
    const button = document.createElement('button');
    button.className = 'cta-btn';
    button.textContent = 'Submit';
    container.appendChild(button);

    const result = serializeDOM(button);

    expect(result.tagName).toBe('button');
    expect(result.textContent).toBe('Submit');
    expect(result.attributes.class).toBe('cta-btn');
    expect(result.boundingRect).toBeDefined();
    expect(result.boundingRect.width).toBeGreaterThanOrEqual(0);
    expect(result.boundingRect.height).toBeGreaterThanOrEqual(0);
  });

  it('includes only whitelisted computed styles', () => {
    const div = document.createElement('div');
    container.appendChild(div);

    const result = serializeDOM(div);

    const styleKeys = Object.keys(result.computedStyles);
    for (const key of styleKeys) {
      expect(COMPUTED_STYLES_WHITELIST).toContain(key);
    }
  });

  it('serializes children up to max depth', () => {
    const parent = document.createElement('div');
    const child = document.createElement('span');
    const grandchild = document.createElement('em');
    child.appendChild(grandchild);
    parent.appendChild(child);
    container.appendChild(parent);

    const result = serializeDOM(parent, 0);

    expect(result.children).toHaveLength(1);
    expect(result.children[0].tagName).toBe('span');
    expect(result.children[0].children).toHaveLength(1);
  });

  it('truncates text content beyond 200 chars at depth > max', () => {
    const div = document.createElement('div');
    const deep = document.createElement('span');
    deep.textContent = 'a'.repeat(300);
    div.appendChild(deep);
    container.appendChild(div);

    const result = serializeDOM(deep, MAX_DOM_DEPTH + 1);

    expect(result.textContent?.length).toBeLessThanOrEqual(200);
  });

  it('marks truncated flag when depth exceeds max', () => {
    const div = document.createElement('div');
    container.appendChild(div);

    const result = serializeDOM(div, MAX_DOM_DEPTH + 1);

    expect(result.truncated).toBe(true);
  });

  it('skips elements with data-feedback-overlay in children', () => {
    const parent = document.createElement('div');
    const visible = document.createElement('span');
    visible.textContent = 'visible';
    const overlay = document.createElement('div');
    overlay.setAttribute('data-feedback-overlay', '');
    overlay.textContent = 'overlay';
    parent.appendChild(visible);
    parent.appendChild(overlay);
    container.appendChild(parent);

    const result = serializeDOM(parent);

    expect(result.children).toHaveLength(1);
    expect(result.children[0].textContent).toBe('visible');
  });
});