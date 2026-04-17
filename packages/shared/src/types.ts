// --- Feedback Submission ---

export type FeedbackStatus = 'open' | 'resolved' | 'dismissed' | 'deleted';
export type FeedbackCategory = 'bug' | 'suggestion' | 'question' | 'other';
export type CaptureMethod = 'html2canvas' | 'native';

export interface FeedbackItem {
  id: string;
  projectId: string;
  status: FeedbackStatus;
  category: FeedbackCategory | null;
  comment: string;
  selector: string;
  url: string;
  viewportWidth: number;
  viewportHeight: number;
  userAgent: string;
  createdBy: string | null;
  captureMethod: CaptureMethod;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

// --- Submission Payload (what the SDK sends) ---

export interface FeedbackMetadata {
  projectId: string;
  comment: string;
  category: FeedbackCategory | null;
  selector: string;
  url: string;
  viewportWidth: number;
  viewportHeight: number;
  userAgent: string;
  captureMethod: CaptureMethod;
}

// --- DOM Snapshot ---

export interface DOMSnapshotNode {
  tagName: string;
  selector: string;
  textContent: string | null;
  attributes: Record<string, string>;
  computedStyles: Record<string, string>;
  boundingRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  children: DOMSnapshotNode[];
  truncated?: boolean;
}

// --- Provider Config ---

export interface PinpointProviderConfig {
  endpoint: string;
  projectId: string;
  categories?: FeedbackCategory[];
  captureMethod?: CaptureMethod;
  theme?: 'light' | 'dark' | 'auto';
  exclude?: string[];
}

// --- Default Values ---

export const DEFAULT_CATEGORIES: FeedbackCategory[] = ['bug', 'suggestion', 'question', 'other'];

export const COMPUTED_STYLES_WHITELIST: string[] = [
  'display',
  'position',
  'color',
  'background-color',
  'font-size',
  'font-weight',
  'font-family',
  'width',
  'height',
  'margin',
  'padding',
  'border',
  'border-radius',
  'overflow',
  'opacity',
  'visibility',
  'z-index',
  'text-align',
  'flex-direction',
  'align-items',
  'justify-content',
  'gap',
];

export const MAX_DOM_DEPTH = 5;
export const MAX_SNAPSHOT_SIZE = 500_000; // 500KB
export const MAX_COMMENT_LENGTH = 2000;
export const MIN_ELEMENT_SIZE = 10; // px