import { describe, it, expect } from 'vitest';
import { canTransition, getAllowedTransitions } from '@/shared/lib/statusMachine';

describe('statusMachine', () => {
  it('allows draft -> review', () => {
    expect(canTransition('draft', 'review')).toBe(true);
  });

  it('allows review -> approved', () => {
    expect(canTransition('review', 'approved')).toBe(true);
  });

  it('allows review -> rejected', () => {
    expect(canTransition('review', 'rejected')).toBe(true);
  });

  it('allows rejected -> draft', () => {
    expect(canTransition('rejected', 'draft')).toBe(true);
  });

  it('allows approved -> published', () => {
    expect(canTransition('approved', 'published')).toBe(true);
  });

  it('disallows draft -> published directly', () => {
    expect(canTransition('draft', 'published')).toBe(false);
  });

  it('disallows published -> any', () => {
    expect(canTransition('published', 'draft')).toBe(false);
    expect(canTransition('published', 'review')).toBe(false);
  });

  it('disallows arbitrary status change', () => {
    expect(canTransition('draft', 'approved')).toBe(false);
    expect(canTransition('rejected', 'published')).toBe(false);
  });

  it('returns allowed transitions from draft', () => {
    expect(getAllowedTransitions('draft')).toEqual(['review']);
  });

  it('returns allowed transitions from review', () => {
    expect(getAllowedTransitions('review')).toEqual(['approved', 'rejected']);
  });

  it('returns empty transitions from published', () => {
    expect(getAllowedTransitions('published')).toEqual([]);
  });
});
