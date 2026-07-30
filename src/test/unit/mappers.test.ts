import { describe, it, expect } from 'vitest';
import { mapReleaseRowToRelease, mapChangeRowToChange } from '@/shared/lib/mappers';

describe('mappers', () => {
  describe('mapReleaseRowToRelease', () => {
    it('maps a full release row correctly', () => {
      const row = {
        id: 'rel-1',
        product_id: 'prod-1',
        version: '1.0.0',
        title: 'First Release',
        description: 'A description',
        status: 'draft' as const,
        planned_at: '2024-01-01T00:00:00Z',
        published_at: null,
        created_by: 'user-1',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        row_version: 1,
        products: { workspace_id: 'ws-1', name: 'Default', slug: 'default' },
      };

      const result = mapReleaseRowToRelease(row);
      expect(result.id).toBe('rel-1');
      expect(result.version).toBe('1.0.0');
      expect(result.title).toBe('First Release');
      expect(result.status).toBe('draft');
      expect(result.row_version).toBe(1);
      expect(result.products?.workspace_id).toBe('ws-1');
      expect(result.products?.slug).toBe('default');
    });

    it('handles null description and published_at', () => {
      const row = {
        id: 'rel-2',
        product_id: 'prod-1',
        version: '2.0.0',
        title: 'Second',
        description: null,
        status: 'published' as const,
        planned_at: null,
        published_at: '2024-06-01T00:00:00Z',
        created_by: 'user-2',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-06-01T00:00:00Z',
        row_version: 5,
      };

      const result = mapReleaseRowToRelease(row);
      expect(result.description).toBeNull();
      expect(result.published_at).toBe('2024-06-01T00:00:00Z');
      expect(result.products).toBeUndefined();
    });
  });

  describe('mapChangeRowToChange', () => {
    it('maps a change row correctly', () => {
      const row = {
        id: 'change-1',
        release_id: 'rel-1',
        title: 'New feature',
        description: 'Added X',
        category: 'feature' as const,
        position: 1,
        created_by: 'user-1',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      const result = mapChangeRowToChange(row);
      expect(result.id).toBe('change-1');
      expect(result.category).toBe('feature');
      expect(result.position).toBe(1);
    });
  });
});
