import { describe, it, expect } from 'vitest';
import { computeApprovalStatus, normalizePositions } from '@/shared/lib/approvalLogic';

describe('computeApprovalStatus', () => {
  it('returns pending when no decisions', () => {
    expect(computeApprovalStatus([])).toBe('pending');
  });

  it('returns approved when all approve', () => {
    expect(computeApprovalStatus(['approve', 'approve', 'approve'])).toBe('approved');
  });

  it('returns rejected when any rejects', () => {
    expect(computeApprovalStatus(['approve', 'reject', 'approve'])).toBe('rejected');
  });

  it('returns pending when decisions incomplete', () => {
    expect(computeApprovalStatus(['approve', null])).toBe('pending');
  });

  it('returns pending when all null', () => {
    expect(computeApprovalStatus([null, null])).toBe('pending');
  });
});

describe('normalizePositions', () => {
  it('renumbers positions sequentially', () => {
    const changes = [
      { id: 'a', position: 5 },
      { id: 'b', position: 2 },
      { id: 'c', position: 10 },
    ];
    const result = normalizePositions(changes);
    expect(result).toEqual([
      { id: 'b', position: 1 },
      { id: 'a', position: 2 },
      { id: 'c', position: 3 },
    ]);
  });

  it('handles single change', () => {
    expect(normalizePositions([{ id: 'a', position: 42 }])).toEqual([{ id: 'a', position: 1 }]);
  });

  it('handles empty array', () => {
    expect(normalizePositions([])).toEqual([]);
  });
});
