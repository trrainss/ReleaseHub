import type { ReleaseStatus } from '@/shared/types';

type Transition = {
  from: ReleaseStatus;
  to: ReleaseStatus;
};

const ALLOWED_TRANSITIONS: Transition[] = [
  { from: 'draft', to: 'review' },
  { from: 'review', to: 'approved' },
  { from: 'review', to: 'rejected' },
  { from: 'rejected', to: 'draft' },
  { from: 'approved', to: 'published' },
];

export function canTransition(from: ReleaseStatus, to: ReleaseStatus): boolean {
  return ALLOWED_TRANSITIONS.some((t) => t.from === from && t.to === to);
}

export function getNextStatus(current: ReleaseStatus): ReleaseStatus | null {
  const transition = ALLOWED_TRANSITIONS.find((t) => t.from === current);
  return transition ? transition.to : null;
}

export function getAllowedTransitions(current: ReleaseStatus): ReleaseStatus[] {
  return ALLOWED_TRANSITIONS
    .filter((t) => t.from === current)
    .map((t) => t.to);
}
