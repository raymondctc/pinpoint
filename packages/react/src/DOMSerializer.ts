import type { DOMSnapshotNode } from '@pinpoint/shared';
import { COMPUTED_STYLES_WHITELIST, MAX_DOM_DEPTH, MAX_SNAPSHOT_SIZE } from '@pinpoint/shared';

const MAX_TEXT_LENGTH_AT_DEPTH = 200;

export function serializeDOM(
  element: HTMLElement,
  depth: number = 0,
): DOMSnapshotNode {
  const tagName = element.tagName.toLowerCase();
  const selector = getElementSelector(element);
  const textContent = truncateText(element.textContent, depth);
  const attributes = getAttributes(element);
  const computedStyles = depth < MAX_DOM_DEPTH
    ? getComputedStyles(element)
    : {};
  const boundingRect = getBoundingRect(element);

  let children: DOMSnapshotNode[] = [];
  let truncated = false;

  if (depth < MAX_DOM_DEPTH) {
    children = getVisibleChildren(element).map(child =>
      serializeDOM(child, depth + 1),
    );
  } else {
    truncated = true;
  }

  const snapshot: DOMSnapshotNode = {
    tagName,
    selector,
    textContent,
    attributes,
    computedStyles,
    boundingRect,
    children,
    ...(truncated ? { truncated: true } : {}),
  };

  // If serialized size exceeds max, truncate children
  if (JSON.stringify(snapshot).length > MAX_SNAPSHOT_SIZE) {
    snapshot.children = [];
    snapshot.truncated = true;
  }

  return snapshot;
}

function getElementSelector(element: HTMLElement): string {
  if (element.id) return `#${element.id}`;
  let selector = element.tagName.toLowerCase();
  if (element.classList?.length > 0) {
    selector += `.${element.classList.item(0)}`;
  }
  return selector;
}

function truncateText(text: string | null, depth: number): string | null {
  if (!text) return null;
  if (depth >= MAX_DOM_DEPTH) {
    return text.length > MAX_TEXT_LENGTH_AT_DEPTH
      ? text.slice(0, MAX_TEXT_LENGTH_AT_DEPTH)
      : text;
  }
  return text;
}

function getAttributes(element: HTMLElement): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (let i = 0; i < element.attributes.length; i++) {
    const attr = element.attributes[i];
    if (attr.name !== 'data-feedback-overlay') {
      attrs[attr.name] = attr.value;
    }
  }
  return attrs;
}

function getComputedStyles(element: HTMLElement): Record<string, string> {
  const styles: Record<string, string> = {};
  const computed = window.getComputedStyle(element);
  for (const prop of COMPUTED_STYLES_WHITELIST) {
    const value = computed.getPropertyValue(prop);
    if (value) {
      styles[prop] = value;
    }
  }
  return styles;
}

function getBoundingRect(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
}

function getVisibleChildren(element: HTMLElement): HTMLElement[] {
  const children: HTMLElement[] = [];
  for (let i = 0; i < element.children.length; i++) {
    const child = element.children[i] as HTMLElement;
    if (child.hasAttribute('data-feedback-overlay')) continue;
    if (child.style?.display === 'none') continue;
    if (child.style?.visibility === 'hidden') continue;
    children.push(child);
  }
  return children;
}