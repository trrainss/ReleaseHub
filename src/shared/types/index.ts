export type Role = 'owner' | 'maintainer' | 'contributor';

export type ReleaseStatus = 'draft' | 'review' | 'approved' | 'rejected' | 'published';

export type ChangeCategory = 'feature' | 'improvement' | 'bugfix' | 'security' | 'breaking';

export type InviteStatus = 'pending' | 'accepted' | 'expired';

export type ApprovalDecision = 'approve' | 'reject' | null;

export type EventType =
  | 'workspace_created'
  | 'release_created'
  | 'release_submitted'
  | 'release_approved'
  | 'release_rejected'
  | 'release_published'
  | 'member_added'
  | 'member_removed'
  | 'role_changed';

export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: Role;
  created_at: string;
}

export interface WorkspaceInvite {
  id: string;
  workspace_id: string;
  email: string;
  role: Role;
  token_hash: string;
  status: InviteStatus;
  expires_at: string;
  invited_by: string;
  created_at: string;
}

export interface Product {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
}

export interface Release {
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
    products?: {
        workspace_id: string;
        name: string;
        slug: string;
    };
    /** Subquery result: count of changes (list queries) or full change array (published releases) */
    release_changes?: { count: number } | ReleaseChange[];
    /** Subquery result: count of reviewers (available in list queries) */
    release_reviewers?: { count: number };
}

export interface ReleaseChange {
  id: string;
  release_id: string;
  title: string;
  description: string;
  category: ChangeCategory;
  position: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ReleaseReviewer {
  id: string;
  release_id: string;
  user_id: string;
  decision: ApprovalDecision;
  decided_at: string | null;
}

export interface Comment {
  id: string;
  release_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface ActivityEvent {
  id: string;
  workspace_id: string;
  release_id: string | null;
  actor_id: string;
  event_type: EventType;
  payload: Record<string, unknown> | null;
  created_at: string;
}
