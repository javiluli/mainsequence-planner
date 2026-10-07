import type { RemovalBlocker } from '../../lib/layout/removal'

const blockerMessages: Record<RemovalBlocker, string> = {
  'empty-selection': 'Select parts, or a single station or note, to delete or cut.',
  'multiple-nodes': 'Delete and Cut support one station or note at a time. Copy supports multiple nodes.',
  'missing-selection': 'The selected elements no longer exist. Select what you want to remove again.',
  'missing-station': 'This station no longer exists. Close the dialog and select another element.',
  'locked-station': 'Unlock this station from its linked modules before deleting or cutting it.',
  'occupied-corridor': 'Remove or move the complete routes or parts crossing its doorways before deleting or cutting this station.',
  'spanning-placement': 'Remove or move the parts spanning this station and its neighbors before deleting or cutting it.',
}

/** Controls and confirmation share explanations while the domain returns stable reason codes. */
export function removalBlockerMessage(reason: RemovalBlocker): string {
  return blockerMessages[reason]
}
