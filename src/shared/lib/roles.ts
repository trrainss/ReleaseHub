import type { Role } from '@/shared/types';

const ROLE_HIERARCHY: Record<Role, number> = {
  owner: 3,
  maintainer: 2,
  contributor: 1,
};

export function isAtLeast(userRole: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export function canManageMembers(role: Role): boolean {
  return role === 'owner';
}

export function canCreateRelease(role: Role): boolean {
  return role === 'owner' || role === 'maintainer';
}

export function canEditRelease(role: Role): boolean {
  return role === 'owner' || role === 'maintainer';
}

export function canDeleteRelease(role: Role): boolean {
  return role === 'owner';
}

export function canSubmitForReview(role: Role): boolean {
  return role === 'owner' || role === 'maintainer';
}

export function canApprove(role: Role): boolean {
  return role === 'owner' || role === 'maintainer';
}

export function canPublish(role: Role): boolean {
  return role === 'owner' || role === 'maintainer';
}

export function canCreateChange(_role: Role): boolean {
  return true;
}

export function canEditChange(_role: Role): boolean {
  return true;
}

export function canDeleteChange(role: Role, isOwnChange: boolean): boolean {
  return role === 'owner' || role === 'maintainer' || isOwnChange;
}

export function canComment(_role: Role): boolean {
  return true;
}

export function canDeleteComment(role: Role, isOwnComment: boolean): boolean {
  return role === 'owner' || isOwnComment;
}

export function canManageWorkspace(role: Role): boolean {
  return role === 'owner';
}
