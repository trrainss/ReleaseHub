import { supabase } from '@/shared/lib/supabase';
import type { Release, ReleaseChange, ReleaseReviewer, Comment, ActivityEvent } from '@/shared/types';
import {
  mapReleaseRowToRelease,
  mapChangeRowToChange,
  mapReviewerRowToReviewer,
  mapCommentRowToComment,
  mapActivityRowToActivity,
} from '@/shared/lib/mappers';
import { sanitizeSearch } from '@/shared/lib/schemas';
import type { CreateReleaseInput, ReleaseFilters, UpdateChangeInput } from '@/shared/lib/schemas';
import { updateChangeSchema } from '@/shared/lib/schemas';
import { mapSupabaseError } from '@/shared/lib/errors';

export async function updateReleaseWithConflictCheck(
  releaseId: string,
  expectedVersion: number,
  updates: Partial<Pick<Release, 'title' | 'description' | 'planned_at'>>,
): Promise<Release> {
  const { data, error } = await supabase.rpc('update_release', {
    p_release_id: releaseId,
    p_title: updates.title ?? null,
    p_description: updates.description ?? null,
    p_planned_at: updates.planned_at ?? null,
    p_expected_version: expectedVersion,
  });
  if (error) throw mapSupabaseError(error);
  return mapReleaseRowToRelease(data as Record<string, unknown>);
}

export async function getReleases(productId: string, filters?: Partial<ReleaseFilters>): Promise<{ data: Release[]; count: number }> {
  let query = supabase
    .from('releases')
    .select('*, release_changes(count), release_reviewers(count)', { count: 'exact' })
    .eq('product_id', productId);

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.search) {
    const clean = sanitizeSearch(filters.search);
    query = query.or(`title.ilike.%${clean}%,version.ilike.%${clean}%`);
  }

  const sortField = filters?.sort === 'version' ? 'version' : 'created_at';
  query = query.order(sortField, { ascending: false });

  const page = filters?.page ?? 1;
  const perPage = filters?.perPage ?? 20;
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  const { data, error, count } = await query.range(from, to);
  if (error) throw mapSupabaseError(error);
  return { data: (data ?? []).map(mapReleaseRowToRelease), count: count ?? 0 };
}

export async function getRelease(id: string): Promise<Release | null> {
  const { data, error } = await supabase
    .from('releases')
    .select(`
      *,
      products (
        workspace_id,
        name,
        slug
      )
    `)
    .eq('id', id)
    .single();
  if (error) throw mapSupabaseError(error);
  return data ? mapReleaseRowToRelease(data as Record<string, unknown>) : null;
}

export async function createRelease(input: CreateReleaseInput): Promise<Release | null> {
  const { data, error } = await supabase
    .from('releases')
    .insert({
      product_id: input.productId,
      version: input.version,
      title: input.title,
      description: input.description ?? null,
      planned_at: input.plannedAt ?? null,
      status: 'draft',
    })
    .select()
    .single();
  if (error) throw mapSupabaseError(error);
  return data ? mapReleaseRowToRelease(data as Record<string, unknown>) : null;
}

// NOTE: updateRelease removed for security — use updateReleaseWithConflictCheck (RPC) instead
// Direct updates bypass RLS role checks and can modify protected fields (status, version, published_at).
// The RPC variant validates role, status machine, and uses optimistic locking.

export async function deleteRelease(id: string) {
  const { error } = await supabase
    .from('releases')
    .delete()
    .eq('id', id);
  if (error) throw mapSupabaseError(error);
}

export async function submitForReview(releaseId: string, reviewerIds: string[]) {
    if (!reviewerIds || !Array.isArray(reviewerIds) || reviewerIds.length === 0) {
        throw new Error('At least one reviewer must be selected');
    }

    const invalidIds = reviewerIds.filter(id => typeof id !== 'string' || id.length === 0);
    if (invalidIds.length > 0) {
        throw new Error(`Invalid reviewer IDs: ${JSON.stringify(invalidIds)}`);
    }

    const { data, error } = await supabase.rpc('submit_release_for_review', {
        p_release_id: releaseId,
        p_reviewer_ids: reviewerIds,
    });

    if (error) throw mapSupabaseError(error);
    return data;
}

export async function approveRelease(releaseId: string): Promise<unknown> {
  const { data, error } = await supabase.rpc('approve_release', { p_release_id: releaseId });
  if (error) throw mapSupabaseError(error);
  return data;
}

export async function rejectRelease(releaseId: string): Promise<unknown> {
  const { data, error } = await supabase.rpc('reject_release', { p_release_id: releaseId });
  if (error) throw mapSupabaseError(error);
  return data;
}

export async function publishRelease(releaseId: string) {
  const { data, error } = await supabase.rpc('publish_release', { p_release_id: releaseId });
  if (error) throw mapSupabaseError(error);
  return data;
}

export async function getChanges(releaseId: string): Promise<ReleaseChange[]> {
  const { data, error } = await supabase
    .from('release_changes')
    .select('*')
    .eq('release_id', releaseId)
    .order('position');
  if (error) throw mapSupabaseError(error);
  return (data ?? []).map(mapChangeRowToChange);
}

export async function createChange(change: {
  release_id: string;
  title: string;
  description: string;
  category: ReleaseChange['category'];
  position: number;
}) {
  const { data, error } = await supabase
    .from('release_changes')
    .insert({
      release_id: change.release_id,
      title: change.title,
      description: change.description,
      category: change.category,
      position: change.position,
      // created_by is set by server via auth.uid()
    })
    .select()
    .single();
  if (error) throw mapSupabaseError(error);
  return data ? mapChangeRowToChange(data as Record<string, unknown>) : null;
}

export async function updateChange(id: string, updates: UpdateChangeInput) {
  const parsed = updateChangeSchema.parse(updates);
  const { error } = await supabase
    .from('release_changes')
    .update(parsed)
    .eq('id', id);
  if (error) throw mapSupabaseError(error);
}

export async function deleteChange(id: string) {
  const { error } = await supabase
    .from('release_changes')
    .delete()
    .eq('id', id);
  if (error) throw mapSupabaseError(error);
}

export async function reorderChanges(changes: { id: string; position: number }[]) {
  const { error } = await supabase.rpc('reorder_changes', { p_changes: changes });
  if (error) throw mapSupabaseError(error);
}

export async function getReviewers(releaseId: string): Promise<(ReleaseReviewer & { profile: { display_name: string; avatar_url: string | null } })[]> {
  const { data, error } = await supabase
    .from('release_reviewers')
    .select('*, profile:profiles!user_id(display_name, avatar_url)')
    .eq('release_id', releaseId);
  if (error) throw mapSupabaseError(error);
  return (data ?? []).map(mapReviewerRowToReviewer);
}

export async function getComments(releaseId: string): Promise<(Comment & { profile: { display_name: string; avatar_url: string | null } })[]> {
  const { data, error } = await supabase
    .from('comments')
    .select('*, profile:profiles!user_id(display_name, avatar_url)')
    .eq('release_id', releaseId)
    .order('created_at');
  if (error) throw mapSupabaseError(error);
  return (data ?? []).map(mapCommentRowToComment);
}

export async function createComment(releaseId: string, content: string) {
  const { data, error } = await supabase
    .from('comments')
    .insert({ release_id: releaseId, content })
    .select('*, profile:profiles!user_id(display_name, avatar_url)')
    .single();
  if (error) throw mapSupabaseError(error);
  return data ? mapCommentRowToComment(data) : null;
}

export async function deleteComment(id: string) {
  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', id);
  if (error) throw mapSupabaseError(error);
}

export async function getActivity(releaseId: string): Promise<ActivityEvent[]> {
  const { data, error } = await supabase
    .from('activity_events')
    .select('*')
    .eq('release_id', releaseId)
    .order('created_at', { ascending: false });
  if (error) throw mapSupabaseError(error);
  return (data ?? []).map(mapActivityRowToActivity);
}

export async function getWorkspaceActivity(workspaceId: string): Promise<ActivityEvent[]> {
  const { data, error } = await supabase
    .from('activity_events')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw mapSupabaseError(error);
  return (data ?? []).map(mapActivityRowToActivity);
}

export async function getPublishedReleases(productSlug: string): Promise<Release[]> {
  const { data, error } = await supabase
    .from('releases')
    .select('*, products!inner(slug), release_changes(*)')
    .eq('products.slug', productSlug)
    .eq('status', 'published')
    .order('published_at', { ascending: false });
  if (error) throw mapSupabaseError(error);
  return (data ?? []).map(mapReleaseRowToRelease);
}

export async function restoreRejectedToDraft(releaseId: string) {
  const { error } = await supabase.rpc('restore_rejected_to_draft', { p_release_id: releaseId });
  if (error) throw mapSupabaseError(error);
}

export async function unpublishRelease(releaseId: string) {
  const { error } = await supabase.rpc('unpublish_release', { p_release_id: releaseId });
  if (error) throw mapSupabaseError(error);
}

export async function getWorkspaceMembersForAssignment(workspaceId: string) {
  const { data, error } = await supabase
    .from('workspace_members')
    .select(`
      user_id,
      role,
      profiles:user_id (
        display_name,
        avatar_url
      )
    `)
    .eq('workspace_id', workspaceId);
  if (error) throw mapSupabaseError(error);
  return (data ?? []).map((item) => ({
    user_id: item.user_id,
    role: item.role,
    profiles: item.profiles,
  }));
}

export async function assignReviewers(releaseId: string, reviewerIds: string[]) {
  const { error } = await supabase.rpc('replace_release_reviewers', {
    p_release_id: releaseId,
    p_reviewer_ids: reviewerIds,
  });
  if (error) throw mapSupabaseError(error);
}

