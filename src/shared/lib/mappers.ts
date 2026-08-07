import type { Database } from '@/shared/api/database.types';
import type {
  Release,
  ReleaseChange,
  ReleaseReviewer,
  Comment,
  ActivityEvent,
  Workspace,
  WorkspaceMember,
  Product,
  Profile,
  ReleaseSummary,
  ReleaseDetails,
  PublishedReleaseNotes,
} from '@/shared/types';
import { releaseRowSchema, changeRowSchema, activityEventRowSchema, approvalDecisionSchema, workspaceRowSchema, productRowSchema, workspaceMemberRowSchema, profileRowSchema, commentRowSchema } from '@/shared/lib/schemas';

/**
 * Mapper functions — convert raw Supabase row objects to typed domain models.
 * Uses generated Database types as source and Zod schemas for runtime validation.
 */

// Generated row types from database.types.ts
type DbReleaseReviewer = Database['public']['Tables']['release_reviewers']['Row'];
type DbComment = Database['public']['Tables']['comments']['Row'];
type DbWorkspace = Database['public']['Tables']['workspaces']['Row'];
type DbWorkspaceMember = Database['public']['Tables']['workspace_members']['Row'];
type DbProduct = Database['public']['Tables']['products']['Row'];
type DbProfile = Database['public']['Tables']['profiles']['Row'];

// Query row types (with joined relations)
interface ReleaseReviewerQueryRow extends DbReleaseReviewer {
  profile?: { display_name: string; avatar_url: string | null } | null;
}

interface CommentQueryRow extends DbComment {
  profile?: { display_name: string; avatar_url: string | null } | null;
}

interface WorkspaceMemberQueryRow extends DbWorkspaceMember {
  profile?: { display_name: string; avatar_url: string | null } | null;
}

// Mapper functions

export function mapReleaseRowToRelease(row: UnknownRecord): Release {
  // Runtime validation at API boundary
  const parsed = releaseRowSchema.parse(row);
  const release: Release = {
    id: parsed.id,
    product_id: parsed.product_id,
    version: parsed.version,
    title: parsed.title,
    description: parsed.description,
    status: parsed.status,
    planned_at: parsed.planned_at,
    published_at: parsed.published_at,
    created_by: parsed.created_by,
    created_at: parsed.created_at,
    updated_at: parsed.updated_at,
    row_version: parsed.row_version,
    products: parsed.products
      ? {
          workspace_id: parsed.products.workspace_id,
          name: parsed.products.name,
          slug: parsed.products.slug,
        }
      : undefined,
  };
  if (parsed.release_changes) {
    if (Array.isArray(parsed.release_changes)) {
      release.release_changes = parsed.release_changes.map(mapChangeRowToChange);
    } else if ('count' in parsed.release_changes) {
      release.release_changes = { count: parsed.release_changes.count };
    }
  }
  if (parsed.release_reviewers && !Array.isArray(parsed.release_reviewers) && 'count' in parsed.release_reviewers) {
    release.release_reviewers = { count: parsed.release_reviewers.count };
  }
  return release;
}

export function mapReleaseToSummary(release: Release): ReleaseSummary {
  return {
    ...release,
    changesCount: (release.release_changes && 'count' in release.release_changes)
      ? release.release_changes.count
      : Array.isArray(release.release_changes)
        ? release.release_changes.length
        : 0,
    reviewersCount: release.release_reviewers?.count ?? 0,
  };
}

export function mapReleaseToDetails(release: Release): ReleaseDetails {
  return {
    id: release.id,
    product_id: release.product_id,
    version: release.version,
    title: release.title,
    description: release.description,
    status: release.status,
    planned_at: release.planned_at,
    published_at: release.published_at,
    created_by: release.created_by,
    created_at: release.created_at,
    updated_at: release.updated_at,
    row_version: release.row_version,
    products: release.products,
  };
}

export function mapReleaseToPublishedNotes(release: Release): PublishedReleaseNotes {
  if (!release.products?.slug) {
    throw new Error('Published release notes require product slug');
  }
  if (release.status !== 'published') {
    throw new Error(`Expected status 'published', got '${release.status}'`);
  }
  return {
    id: release.id,
    product_id: release.product_id,
    version: release.version,
    title: release.title,
    description: release.description,
    status: 'published' as const,
    planned_at: release.planned_at,
    published_at: release.published_at,
    created_by: release.created_by,
    created_at: release.created_at,
    updated_at: release.updated_at,
    row_version: release.row_version,
    changes: Array.isArray(release.release_changes) ? release.release_changes : [],
    product: {
      name: release.products?.name ?? '',
      slug: release.products.slug,
    },
  };
}

export function mapChangeRowToChange(row: UnknownRecord): ReleaseChange {
  const parsed = changeRowSchema.parse(row);
  return {
    id: parsed.id,
    release_id: parsed.release_id,
    title: parsed.title,
    description: parsed.description,
    category: parsed.category,
    position: parsed.position,
    created_by: parsed.created_by,
    created_at: parsed.created_at,
    updated_at: parsed.updated_at,
  };
}

export function mapReviewerRowToReviewer(
  row: ReleaseReviewerQueryRow,
): ReleaseReviewer & { profile: { display_name: string; avatar_url: string | null } } {
  return {
    id: row.id,
    release_id: row.release_id,
    user_id: row.user_id,
    decision: approvalDecisionSchema.parse(row.decision),
    decided_at: row.decided_at,
    profile: row.profile ?? { display_name: 'Unknown', avatar_url: null },
  };
}

export function mapActivityRowToActivity(row: UnknownRecord): ActivityEvent {
  const parsed = activityEventRowSchema.parse(row);
  return {
    id: parsed.id,
    workspace_id: parsed.workspace_id,
    release_id: parsed.release_id,
    actor_id: parsed.actor_id,
    event_type: parsed.event_type,
    payload: parsed.payload as Record<string, unknown> | null,
    created_at: parsed.created_at,
  };
}

export function mapWorkspaceRowToWorkspace(row: DbWorkspace): Workspace {
  const parsed = workspaceRowSchema.parse(row);
  return {
    id: parsed.id,
    name: parsed.name,
    created_by: parsed.created_by,
    created_at: parsed.created_at,
  };
}

export function mapMemberRowToMember(
  row: WorkspaceMemberQueryRow,
): WorkspaceMember & { profile: { display_name: string; avatar_url: string | null } } {
  const parsed = workspaceMemberRowSchema.parse(row);
  return {
    id: parsed.id,
    workspace_id: parsed.workspace_id,
    user_id: parsed.user_id,
    role: parsed.role,
    created_at: parsed.created_at,
    profile: row.profile ?? { display_name: 'Unknown', avatar_url: null },
  };
}

export function mapProductRowToProduct(row: DbProduct): Product {
  const parsed = productRowSchema.parse(row);
  return {
    id: parsed.id,
    workspace_id: parsed.workspace_id,
    name: parsed.name,
    slug: parsed.slug,
    description: parsed.description,
    created_at: parsed.created_at,
  };
}

export function mapProfileRowToProfile(row: DbProfile): Profile {
  const parsed = profileRowSchema.parse(row);
  return {
    id: parsed.id,
    display_name: parsed.display_name,
    avatar_url: parsed.avatar_url,
    created_at: parsed.created_at,
  };
}

export function mapCommentRowToComment(
  row: CommentQueryRow,
): Comment & { profile: { display_name: string; avatar_url: string | null } } {
  const parsed = commentRowSchema.parse(row);
  return {
    id: parsed.id,
    release_id: parsed.release_id,
    user_id: parsed.user_id,
    content: parsed.content,
    created_at: parsed.created_at,
    updated_at: parsed.updated_at,
    profile: row.profile ?? { display_name: 'Unknown', avatar_url: null },
  };
}

// Helper type for unknown input data (before Zod validation)
type UnknownRecord = Record<string, unknown>;
