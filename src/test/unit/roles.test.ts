import { describe, it, expect } from 'vitest';
import {
  isAtLeast,
  canManageMembers,
  canCreateRelease,
  canPublish,
  canDeleteChange,
  canManageWorkspace,
} from '@/shared/lib/roles';

describe('roles', () => {
  describe('isAtLeast', () => {
    it('owner is at least owner', () => expect(isAtLeast('owner', 'owner')).toBe(true));
    it('owner is at least maintainer', () => expect(isAtLeast('owner', 'maintainer')).toBe(true));
    it('owner is at least contributor', () => expect(isAtLeast('owner', 'contributor')).toBe(true));
    it('maintainer is at least maintainer but not owner', () => {
      expect(isAtLeast('maintainer', 'maintainer')).toBe(true);
      expect(isAtLeast('maintainer', 'owner')).toBe(false);
    });
    it('contributor is only at least contributor', () => {
      expect(isAtLeast('contributor', 'contributor')).toBe(true);
      expect(isAtLeast('contributor', 'maintainer')).toBe(false);
      expect(isAtLeast('contributor', 'owner')).toBe(false);
    });
  });

  it('only owner can manage members', () => {
    expect(canManageMembers('owner')).toBe(true);
    expect(canManageMembers('maintainer')).toBe(false);
    expect(canManageMembers('contributor')).toBe(false);
  });

  it('owner and maintainer can create releases', () => {
    expect(canCreateRelease('owner')).toBe(true);
    expect(canCreateRelease('maintainer')).toBe(true);
    expect(canCreateRelease('contributor')).toBe(false);
  });

  it('owner and maintainer can publish', () => {
    expect(canPublish('owner')).toBe(true);
    expect(canPublish('maintainer')).toBe(true);
    expect(canPublish('contributor')).toBe(false);
  });

  it('owner can delete any change, maintainer can delete any, contributor only own', () => {
    expect(canDeleteChange('owner', false, 'draft')).toBe(true);
    expect(canDeleteChange('owner', true, 'draft')).toBe(true);
    expect(canDeleteChange('maintainer', false, 'draft')).toBe(true);
    expect(canDeleteChange('maintainer', true, 'draft')).toBe(true);
    expect(canDeleteChange('contributor', true, 'draft')).toBe(true);
    expect(canDeleteChange('contributor', false, 'draft')).toBe(false);
  });

  it('only owner can manage workspace', () => {
    expect(canManageWorkspace('owner')).toBe(true);
    expect(canManageWorkspace('maintainer')).toBe(false);
    expect(canManageWorkspace('contributor')).toBe(false);
  });
});
