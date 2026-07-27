import { supabase } from '@/shared/lib/supabase';
import type { Release, ReleaseChange, ReleaseReviewer, Comment, ActivityEvent } from '@/shared/types';

export async function updateReleaseWithConflictCheck(
  releaseId: string,
  expectedVersion: number,
  updates: Partial<Pick<Release, 'title' | 'description' | 'planned_at'>>,
) {
  const { data, error } = await supabase.rpc('update_release', {
    p_release_id: releaseId,
    p_title: updates.title ?? null,
    p_description: updates.description ?? null,
    p_planned_at: updates.planned_at ?? null,
    p_expected_version: expectedVersion,
  });
  if (error) throw error;
  return data as Release;
}

export async function getReleases(productId: string, filters?: { status?: string; search?: string; sort?: string; page?: number; perPage?: number }) {
  let query = supabase
    .from('releases')
    .select('*, release_changes(count)', { count: 'exact' })
    .eq('product_id', productId);

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.search) {
    query = query.or(`title.ilike.%${filters.search}%,version.ilike.%${filters.search}%`);
  }

  const sortField = filters?.sort === 'version' ? 'version' : 'created_at';
  query = query.order(sortField, { ascending: false });

  const page = filters?.page ?? 1;
  const perPage = filters?.perPage ?? 20;
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  const { data, error, count } = await query.range(from, to);
  if (error) throw error;
  return { data: data ?? [], count: count ?? 0 };
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
  if (error) throw error;
  return data;
}

export async function createRelease(release: Omit<Release, 'id' | 'created_at' | 'updated_at' | 'status' | 'row_version'>) {
  const { data, error } = await supabase
    .from('releases')
    .insert({ ...release, status: 'draft' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateRelease(id: string, updates: Partial<Omit<Release, 'id' | 'created_at' | 'updated_at' | 'row_version'>>) {
  const { data, error } = await supabase
    .from('releases')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteRelease(id: string) {
  const { error } = await supabase
    .from('releases')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function submitForReview(releaseId: string, reviewerIds: string[]) {
    console.log('🔵 submitForReview called with:');
    console.log('  releaseId:', releaseId);
    console.log('  reviewerIds:', reviewerIds);
    console.log('  reviewerIds type:', typeof reviewerIds);
    console.log('  is array:', Array.isArray(reviewerIds));
    console.log('  length:', reviewerIds?.length);

    // Проверяем, что reviewerIds - это массив и не пустой
    if (!reviewerIds || !Array.isArray(reviewerIds) || reviewerIds.length === 0) {
        const error = new Error('At least one reviewer must be selected');
        console.error('🔴 Validation error:', error);
        throw error;
    }

    // Проверяем, что все ID - это строки
    const invalidIds = reviewerIds.filter(id => typeof id !== 'string' || id.length === 0);
    if (invalidIds.length > 0) {
        const error = new Error(`Invalid reviewer IDs: ${JSON.stringify(invalidIds)}`);
        console.error(' Invalid IDs:', invalidIds);
        throw error;
    }

    try {
        const { data, error } = await supabase.rpc('submit_release_for_review', {
            p_release_id: releaseId,
            p_reviewer_ids: reviewerIds,
        });
        
        if (error) {
            console.error(' Supabase RPC error:', error);
            console.error(' Error details:', {
                code: error.code,
                message: error.message,
                details: error.details,
                hint: error.hint
            });
            throw new Error(`Failed to submit: ${error.message}`);
        }
        
        console.log(' Submit successful:', data);
        return data;
    } catch (err) {
        console.error(' Unexpected error:', err);
        throw err;
    }
}

export async function approveRelease(releaseId: string) {
  const { data, error } = await supabase.rpc('approve_release', { p_release_id: releaseId });
  if (error) throw error;
  return data;
}

export async function rejectRelease(releaseId: string) {
  const { data, error } = await supabase.rpc('reject_release', { p_release_id: releaseId });
  if (error) throw error;
  return data;
}

export async function publishRelease(releaseId: string) {
  const { data, error } = await supabase.rpc('publish_release', { p_release_id: releaseId });
  if (error) throw error;
  return data;
}

export async function getChanges(releaseId: string): Promise<ReleaseChange[]> {
  const { data, error } = await supabase
    .from('release_changes')
    .select('*')
    .eq('release_id', releaseId)
    .order('position');
  if (error) throw error;
  return data ?? [];
}

export async function createChange(change: Omit<ReleaseChange, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('release_changes')
    .insert(change)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateChange(id: string, updates: Partial<Omit<ReleaseChange, 'id' | 'created_at' | 'updated_at'>>) {
  const { error } = await supabase
    .from('release_changes')
    .update(updates)
    .eq('id', id);
  if (error) throw error;
}

export async function deleteChange(id: string) {
  const { error } = await supabase
    .from('release_changes')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function reorderChanges(changes: { id: string; position: number }[]) {
  const { error } = await supabase.rpc('reorder_changes', { p_changes: changes });
  if (error) throw error;
}

export async function getReviewers(releaseId: string): Promise<(ReleaseReviewer & { profile: { display_name: string; avatar_url: string | null } })[]> {
  const { data, error } = await supabase
    .from('release_reviewers')
    .select('*, profile:profiles!user_id(display_name, avatar_url)')
    .eq('release_id', releaseId);
  if (error) throw error;
  return data ?? [];
}

export async function getComments(releaseId: string): Promise<(Comment & { profile: { display_name: string; avatar_url: string | null } })[]> {
  const { data, error } = await supabase
    .from('comments')
    .select('*, profile:profiles!user_id(display_name, avatar_url)')
    .eq('release_id', releaseId)
    .order('created_at');
  if (error) throw error;
  return data ?? [];
}

export async function createComment(releaseId: string, userId: string, content: string) {
  const { data, error } = await supabase
    .from('comments')
    .insert({ release_id: releaseId, user_id: userId, content })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteComment(id: string) {
  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function getActivity(releaseId: string): Promise<ActivityEvent[]> {
  const { data, error } = await supabase
    .from('activity_events')
    .select('*')
    .eq('release_id', releaseId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getWorkspaceActivity(workspaceId: string): Promise<ActivityEvent[]> {
  const { data, error } = await supabase
    .from('activity_events')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function getPublishedReleases(productSlug: string): Promise<Release[]> {
  const { data, error } = await supabase
    .from('releases')
    .select('*, products!inner(slug), release_changes(*)')
    .eq('products.slug', productSlug)
    .eq('status', 'published')
    .order('published_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function inviteMember(workspaceId: string, email: string, role: string) {
  const { data, error } = await supabase.rpc('invite_member', {
    p_workspace_id: workspaceId,
    p_email: email,
    p_role: role,
  });
  if (error) throw error;
  return data;
}

export async function getInvites(workspaceId: string) {
  const { data, error } = await supabase
    .from('workspace_invites')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function removeMember(workspaceId: string, userId: string) {
  const { error } = await supabase
    .from('workspace_members')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function updateMemberRole(workspaceId: string, userId: string, role: string) {
  const { error } = await supabase
    .from('workspace_members')
    .update({ role })
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function acceptInvite(tokenHash: string) {
  const { data, error } = await supabase.rpc('accept_invite', { p_token_hash: tokenHash });
  if (error) throw error;
  return data;
}
