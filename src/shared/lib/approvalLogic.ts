import type { ApprovalDecision } from '@/shared/types';

export function computeApprovalStatus(decisions: ApprovalDecision[]): 'approved' | 'rejected' | 'pending' {
  if (decisions.length === 0) return 'pending';

  const hasReject = decisions.some((d) => d === 'reject');
  if (hasReject) return 'rejected';

  const allApproved = decisions.every((d) => d === 'approve');
  if (allApproved) return 'approved';

  return 'pending';
}

export function normalizePositions(
  changes: { id: string; position: number }[],
): { id: string; position: number }[] {
  return changes
    .sort((a, b) => a.position - b.position)
    .map((change, index) => ({
      id: change.id,
      position: index + 1,
    }));
}
