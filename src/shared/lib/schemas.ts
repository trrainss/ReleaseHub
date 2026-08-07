import { z } from 'zod';
import type { ReleaseStatus, ChangeCategory, Role, EventType } from '@/shared/types';

// ============================================================
// Enum schemas
// ============================================================

export const releaseStatusSchema = z.enum(['draft', 'review', 'approved', 'rejected', 'published']) as z.ZodType<ReleaseStatus>;
export const changeCategorySchema = z.enum(['feature', 'improvement', 'bugfix', 'security', 'breaking']) as z.ZodType<ChangeCategory>;
export const roleSchema = z.enum(['owner', 'maintainer', 'contributor']) as z.ZodType<Role>;
export const eventTypeSchema = z.enum([
  'workspace_created', 'release_created', 'release_submitted',
  'release_approved', 'release_rejected', 'release_published',
  'member_added', 'member_removed', 'role_changed',
  'release_restored', 'release_unpublished', 'product_created',
  'reviewer_replaced',
]) as z.ZodType<EventType>;

// ============================================================
// Row schemas (validated at API boundary)
// ============================================================

export const releaseRowSchema = z.object({
  id: z.string().uuid(),
  product_id: z.string().uuid(),
  version: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullable(),
  status: releaseStatusSchema,
  planned_at: z.string().nullable(),
  published_at: z.string().nullable(),
  created_by: z.string().uuid(),
  created_at: z.string(),
  updated_at: z.string(),
  row_version: z.number().int().positive(),
  products: z.object({
    workspace_id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
  }).nullable().optional(),
  release_changes: z.union([
    z.array(z.lazy(() => changeRowSchema)),
    z.object({ count: z.number() }),
  ]).nullable().optional(),
  release_reviewers: z.object({ count: z.number() }).nullable().optional(),
});

export const changeRowSchema = z.object({
  id: z.string().uuid(),
  release_id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string(),
  category: changeCategorySchema,
  position: z.number().int().min(0),
  created_by: z.string().uuid(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const activityEventRowSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  release_id: z.string().uuid().nullable(),
  actor_id: z.string().uuid(),
  event_type: eventTypeSchema,
  payload: z.record(z.string(), z.unknown()).nullable(),
  created_at: z.string(),
});

// ============================================================
// Command DTOs (narrow, client-only input types)
// ============================================================

export const createReleaseSchema = z.object({
  productId: z.string().uuid(),
  version: z.string().min(1, 'Version is required').max(50),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).optional(),
  plannedAt: z.string().optional(),
});

export type CreateReleaseInput = z.infer<typeof createReleaseSchema>;

export const createChangeSchema = z.object({
  releaseId: z.string().uuid(),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().min(1, 'Description is required').max(2000),
  category: changeCategorySchema,
  position: z.number().int().min(0),
});

export type CreateChangeInput = z.infer<typeof createChangeSchema>;

export const updateChangeSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(2000).optional(),
  category: changeCategorySchema.optional(),
});

export type UpdateChangeInput = z.infer<typeof updateChangeSchema>;

export const createCommentSchema = z.object({
  releaseId: z.string().uuid(),
  content: z.string().min(1, 'Content is required').max(5000),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const releaseFiltersSchema = z.object({
  status: releaseStatusSchema.optional(),
  search: z.string().trim().max(100).optional(),
  sort: z.enum(['created_at', 'version']).default('created_at'),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
});

export type ReleaseFilters = z.infer<typeof releaseFiltersSchema>;

export const reviewerIdsSchema = z
  .array(z.string().uuid())
  .min(1, 'Select at least one reviewer');

export const productSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  slug: z
    .string()
    .trim()
    .min(1, 'Slug is required')
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().trim().max(1000).optional(),
});

export type ProductInput = z.infer<typeof productSchema>;

export const workspaceNameSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
});

export type WorkspaceNameInput = z.infer<typeof workspaceNameSchema>;

export const approvalDecisionSchema = z.enum(['approve', 'reject']).nullable();

export const inviteDataSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  email: z.string().email(),
  role: roleSchema,
  status: z.enum(['pending', 'accepted', 'expired']),
  expires_at: z.string(),
  invited_by: z.string().uuid(),
  created_at: z.string(),
  workspaces: z
    .object({ name: z.string() })
    .nullable()
    .optional(),
});

export type InviteData = z.infer<typeof inviteDataSchema>;

export const workspaceRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  created_by: z.string().uuid(),
  created_at: z.string(),
});

export const productRowSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().nullable(),
  created_at: z.string(),
});

export const workspaceMemberRowSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  user_id: z.string().uuid(),
  role: roleSchema,
  created_at: z.string(),
});

export const profileRowSchema = z.object({
  id: z.string().uuid(),
  display_name: z.string(),
  avatar_url: z.string().nullable(),
  created_at: z.string(),
});

export const commentRowSchema = z.object({
  id: z.string().uuid(),
  release_id: z.string().uuid(),
  user_id: z.string().uuid(),
  content: z.string().min(1),
  created_at: z.string(),
  updated_at: z.string(),
});

// ============================================================
// Search query sanitization
// ============================================================

export function sanitizeSearch(search: string): string {
  return search.trim().replace(/[(),.%]/g, '\\$&').slice(0, 100);
}