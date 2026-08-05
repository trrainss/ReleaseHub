import { describe, it, expect } from 'vitest';
import { mapReleaseRowToRelease, mapChangeRowToChange } from '@/shared/lib/mappers';

// Valid UUIDs for test data (RFC 4122 version 4 format)
const UUID = {
  release1: '00000000-0000-4000-8000-000000000001',
  release2: '00000000-0000-4000-8000-000000000002',
  product1: '00000000-0000-4000-8000-000000000003',
  workspace1: '00000000-0000-4000-8000-000000000004',
  user1: '00000000-0000-4000-8000-000000000005',
  user2: '00000000-0000-4000-8000-000000000006',
  change1: '00000000-0000-4000-8000-000000000007',
};

describe('mappers', () => {
  describe('mapReleaseRowToRelease', () => {
    it('maps a full release row correctly', () => {
      const row = {
        id: UUID.release1,
        product_id: UUID.product1,
        version: '1.0.0',
        title: 'First Release',
        description: 'A description',
        status: 'draft' as const,
        planned_at: '2024-01-01T00:00:00Z',
        published_at: null,
        created_by: UUID.user1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        row_version: 1,
        products: { workspace_id: UUID.workspace1, name: 'Default', slug: 'default' },
      };

      const result = mapReleaseRowToRelease(row);
      expect(result.id).toBe(UUID.release1);
      expect(result.version).toBe('1.0.0');
      expect(result.title).toBe('First Release');
      expect(result.status).toBe('draft');
      expect(result.row_version).toBe(1);
      expect(result.products?.workspace_id).toBe(UUID.workspace1);
      expect(result.products?.slug).toBe('default');
    });

    it('handles null description and published_at', () => {
      const row = {
        id: UUID.release2,
        product_id: UUID.product1,
        version: '2.0.0',
        title: 'Second',
        description: null,
        status: 'published' as const,
        planned_at: null,
        published_at: '2024-06-01T00:00:00Z',
        created_by: UUID.user2,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-06-01T00:00:00Z',
        row_version: 5,
      };

      const result = mapReleaseRowToRelease(row);
      expect(result.description).toBeNull();
      expect(result.published_at).toBe('2024-06-01T00:00:00Z');
      expect(result.products).toBeUndefined();
    });

    it('rejects invalid status enum at runtime', () => {
      const row = {
        id: UUID.release1,
        product_id: UUID.product1,
        version: '1.0.0',
        title: 'Test',
        description: null,
        status: 'unknown_status',
        planned_at: null,
        published_at: null,
        created_by: UUID.user1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        row_version: 1,
      };

      expect(() => mapReleaseRowToRelease(row)).toThrow();
    });

    it('rejects invalid row_version type', () => {
      const row = {
        id: UUID.release1,
        product_id: UUID.product1,
        version: '1.0.0',
        title: 'Test',
        description: null,
        status: 'draft',
        planned_at: null,
        published_at: null,
        created_by: UUID.user1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        row_version: '1',
      };

      expect(() => mapReleaseRowToRelease(row)).toThrow();
    });
  });

  describe('mapChangeRowToChange', () => {
    it('maps a change row correctly', () => {
      const row = {
        id: UUID.change1,
        release_id: UUID.release1,
        title: 'New feature',
        description: 'Added X',
        category: 'feature' as const,
        position: 1,
        created_by: UUID.user1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      const result = mapChangeRowToChange(row);
      expect(result.id).toBe(UUID.change1);
      expect(result.category).toBe('feature');
      expect(result.position).toBe(1);
    });

    it('rejects invalid category enum at runtime', () => {
      const row = {
        id: UUID.change1,
        release_id: UUID.release1,
        title: 'Test',
        description: 'desc',
        category: 'arbitrary',
        position: 1,
        created_by: UUID.user1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      expect(() => mapChangeRowToChange(row)).toThrow();
    });

    it('rejects non-UUID id', () => {
      const row = {
        id: 'not-a-uuid',
        release_id: UUID.release1,
        title: 'Test',
        description: 'desc',
        category: 'feature',
        position: 1,
        created_by: UUID.user1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      expect(() => mapChangeRowToChange(row)).toThrow();
    });
  });
});
