/**
 * D11.5 — Shared task staging predicate.
 * ONE exported value. Staged is true when ANY of:
 *   1. A DUE chip has been tapped and differs from the committed value
 *   2. The note composer is non-empty (trimmed — whitespace-only does not stage)
 *   3. The title has been edited and differs from the committed value
 *   4. The LIST toggle differs from the committed value
 *
 * Consumed by: mobile TaskDetailSheet, desktop D11 modal.
 * VoiceNote / NewTask / NewEvent keep their own canSave — different objects.
 */

export interface TaskStagingState {
  stagedDate: string | null        // null = no chip tapped
  committedDate: string | null     // task.due_date at open time
  noteText: string                 // raw composer value
  titleEdited: boolean             // title differs from committed
  listType: 'life' | 'entity' | null
  committedListType: 'life' | 'entity' | null
}

export function isTaskStaged(s: TaskStagingState): boolean {
  // 1. DUE chip staged and differs from committed
  if (s.stagedDate !== null && s.stagedDate !== s.committedDate) return true
  // 2. Note composer non-empty (trimmed — whitespace-only does not stage)
  if (s.noteText.trim().length > 0) return true
  // 3. Title edited and differs from committed
  if (s.titleEdited) return true
  // 4. LIST toggle differs from committed
  if (s.listType !== s.committedListType) return true
  return false
}
