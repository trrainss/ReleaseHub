import { describe, it, expect } from 'vitest';
import { normalizePositions } from '@/shared/lib/approvalLogic';

describe('normalizePositions', () => {
  it('eliminates duplicate positions', () => {
    const changes = [
      { id: 'a', position: 1 },
      { id: 'b', position: 1 },
      { id: 'c', position: 3 },
    ];
    const result = normalizePositions(changes);
    expect(result.map((r) => r.position)).toEqual([1, 2, 3]);
  });

  it('handles gaps in positions', () => {
    const changes = [
      { id: 'x', position: 100 },
      { id: 'y', position: 200 },
    ];
    const result = normalizePositions(changes);
    expect(result).toEqual([
      { id: 'x', position: 1 },
      { id: 'y', position: 2 },
    ]);
  });
});
