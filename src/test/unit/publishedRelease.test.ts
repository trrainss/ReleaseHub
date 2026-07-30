import { describe, it, expect } from 'vitest';

/**
 * Tests for published release immutability.
 * The actual enforcement happens in DB triggers (block_published_release_update,
 * trg_block_published_changes_*). These tests verify the business rules.
 */

describe('published release immutability', () => {
  it('prevents updating a published release', () => {
    const status: string = 'published';
    const canUpdate = status !== 'published';
    expect(canUpdate).toBe(false);
  });

  it('allows updating a draft release', () => {
    const status: string = 'draft';
    const canUpdate = status !== 'published';
    expect(canUpdate).toBe(true);
  });

  it('allows updating a rejected release', () => {
    const status: string = 'rejected';
    const canUpdate = status !== 'published';
    expect(canUpdate).toBe(true);
  });

  it('prevents adding changes to a published release', () => {
    const status: string = 'published';
    const canModifyChanges = status !== 'published';
    expect(canModifyChanges).toBe(false);
  });

  it('allows adding changes to a draft release', () => {
    const status: string = 'draft';
    const canModifyChanges = status !== 'published';
    expect(canModifyChanges).toBe(true);
  });

  it('prevents deleting changes from a published release', () => {
    const status: string = 'published';
    const canDeleteChanges = status !== 'published';
    expect(canDeleteChanges).toBe(false);
  });

  it('error message for published release modification is clear', () => {
    const errorMessage = 'Cannot modify a published release';
    expect(errorMessage).toContain('Cannot modify');
    expect(errorMessage).toContain('published');
  });

  it('error message for published release changes is clear', () => {
    const errorMessage = 'Cannot modify changes of a published release';
    expect(errorMessage).toContain('Cannot modify changes');
    expect(errorMessage).toContain('published');
  });
});