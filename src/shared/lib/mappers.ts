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
} from '@/shared/types';

/**
 * Mapper functions — convert raw Supabase row objects to typed domain models.
 * This implements the DTO/mapper layer (ADR-2, variant B).
 */

// Raw row types from Supabase (snake_case, nullable fields as they come from DB)

interface ReleaseRow {
  id: string;
  product_id: string;
  version: string;
  title: string;
  description: string | null;
  status: 'draft' | 'review' | 'approved' | 'rejected' | 'published';
  planned_at: string | null;
  published_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  row_version: number;
  products?: { workspace_id: string; name: string; slug: string } | null;
  release_changes?: ReleaseChangeRow[] | { count: number } | null;
  release_reviewers?: ReleaseReviewerRow[] | { count: number } | null;
}

interface ReleaseChangeRow {
  id: string;
  release_id: string;
  title: string;
  description: string;
  category: 'feature' | 'improvement' | 'bugfix' | 'security' | 'breaking';
  position: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface ReleaseReviewerRow {
  id: string;
  release_id: string;
  user_id: string;
  decision: 'approve' | 'reject' | null;
  decided_at: string | null;
  profile?: { display_name: string; avatar_url: string | null } | null;
}

interface CommentRow {
  id: string;
  release_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  profile?: { display_name: string; avatar_url: string | null } | null;
}

interface ActivityEventRow {
  id: string;
  workspace_id: string;
  release_id: string | null;
  actor_id: string;
  event_type: string;
  payload: Record<string, unknown> | null;
  created_at: string;
}

interface WorkspaceRow {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
}

interface WorkspaceMemberRow {
  id: string;
  workspace_id: string;
  user_id: string;
  role: 'owner' | 'maintainer' | 'contributor';
  created_at: string;
  profile?: { display_name: string; avatar_url: string | null } | null;
}

interface ProductRow {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
}

interface ProfileRow {
  id: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
}

// Mapper functions

export function mapReleaseRowToRelease(row: ReleaseRow): Release {
  const release: Release = {
    id: row.id,
    product_id: row.product_id,
    version: row.version,
    title: row.title,
    description: row.description,
    status: row.status,
    planned_at: row.planned_at,
    published_at: row.published_at,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    row_version: row.row_version,
    products: row.products
      ? {
          workspace_id: row.products.workspace_id,
          name: row.products.name,
          slug: row.products.slug,
        }
      : undefined,
  };
  // Pass through subquery results if present
  if (row.release_changes) {
    if (Array.isArray(row.release_changes)) {
      release.release_changes = row.release_changes.map(mapChangeRowToChange);
    } else if ('count' in row.release_changes) {
      release.release_changes = { count: row.release_changes.count };
    }
  }
  if (row.release_reviewers && !Array.isArray(row.release_reviewers) && 'count' in row.release_reviewers) {
    release.release_reviewers = { count: row.release_reviewers.count };
  }
  return release;
}

export function mapChangeRowToChange(row: ReleaseChangeRow): ReleaseChange {
  return {
    id: row.id,
    release_id: row.release_id,
    title: row.title,
    description: row.description,
    category: row.category,
    position: row.position,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapReviewerRowToReviewer(
  row: ReleaseReviewerRow,
): ReleaseReviewer & { profile: { display_name: string; avatar_url: string | null } } {
  return {
    id: row.id,
    release_id: row.release_id,
    user_id: row.user_id,
    decision: row.decision,
    decided_at: row.decided_at,
    profile: row.profile ?? { display_name: 'Unknown', avatar_url: null },
  };
}

export function mapCommentRowToComment(
  row: CommentRow,
): Comment & { profile: { display_name: string; avatar_url: string | null } } {
  return {
    id: row.id,
    release_id: row.release_id,
    user_id: row.user_id,
    content: row.content,
    created_at: row.created_at,
    updated_at: row.updated_at,
    profile: row.profile ?? { display_name: 'Unknown', avatar_url: null },
  };
}

export function mapActivityRowToActivity(row: ActivityEventRow): ActivityEvent {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    release_id: row.release_id,
    actor_id: row.actor_id,
    event_type: row.event_type as ActivityEvent['event_type'],
    payload: row.payload,
    created_at: row.created_at,
  };
}

export function mapWorkspaceRowToWorkspace(row: WorkspaceRow): Workspace {
  return {
    id: row.id,
    name: row.name,
    created_by: row.created_by,
    created_at: row.created_at,
  };
}

export function mapMemberRowToMember(
  row: WorkspaceMemberRow,
): WorkspaceMember & { profile: { display_name: string; avatar_url: string | null } } {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    user_id: row.user_id,
    role: row.role,
    created_at: row.created_at,
    profile: row.profile ?? { display_name: 'Unknown', avatar_url: null },
  };
}

export function mapProductRowToProduct(row: ProductRow): Product {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    created_at: row.created_at,
  };
}

export function mapProfileRowToProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    display_name: row.display_name,
    avatar_url: row.avatar_url,
    created_at: row.created_at,
  };
}
