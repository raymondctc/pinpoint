import type { FeedbackMetadata, DOMSnapshotNode } from '@pinpoint/shared';

interface SubmitFeedbackParams {
  endpoint: string;
  metadata: FeedbackMetadata;
  screenshot: Blob | null;
  domSnapshot: DOMSnapshotNode;
}

interface SubmitResult {
  success: boolean;
  id?: string;
  error?: string;
}

export async function submitFeedback(
  params: SubmitFeedbackParams,
): Promise<SubmitResult> {
  const { endpoint, metadata, screenshot, domSnapshot } = params;

  const formData = new FormData();
  formData.append('metadata', JSON.stringify(metadata));

  if (screenshot) {
    formData.append('screenshot', screenshot, 'screenshot.png');
  }

  formData.append(
    'dom-snapshot',
    new Blob([JSON.stringify(domSnapshot)], { type: 'application/json' }),
    'dom-snapshot.json',
  );

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData,
    });

    if (response.status === 201) {
      const body = await response.json();
      return { success: true, id: body.id };
    }

    const errorBody = await response.text();
    return {
      success: false,
      error: `Server returned ${response.status}: ${errorBody}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}