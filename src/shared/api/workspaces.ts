import { supabase } from '@/shared/lib/supabase';
import type { Workspace, WorkspaceMember, Product } from '@/shared/types';
import { mapWorkspaceRowToWorkspace, mapMemberRowToMember, mapProductRowToProduct } from '@/shared/lib/mappers';

export async function createWorkspace(name: string, _userId: string) {
    const { data, error } = await supabase.rpc('create_workspace', {
        workspace_name: name,
    });
    if (error) throw error;
    return data;
}

export async function getWorkspaces(): Promise<Workspace[]> {
  const { data, error } = await supabase
    .from('workspaces')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapWorkspaceRowToWorkspace);
}

export async function getWorkspace(id: string): Promise<Workspace | null> {
  const { data, error } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data ? mapWorkspaceRowToWorkspace(data) : null;
}

export async function updateWorkspace(id: string, updates: Partial<Pick<Workspace, 'name'>>) {
  const { error } = await supabase
    .from('workspaces')
    .update(updates)
    .eq('id', id);
  if (error) throw error;
}

export async function deleteWorkspace(id: string) {
  const { error } = await supabase
    .from('workspaces')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function getWorkspaceMembers(workspaceId: string): Promise<(WorkspaceMember & { profile: { display_name: string; avatar_url: string | null } })[]> {
  const { data, error } = await supabase
    .from('workspace_members')
    .select('*, profile:profiles!user_id(display_name, avatar_url)')
    .eq('workspace_id', workspaceId);
  if (error) throw error;
  return (data ?? []).map(mapMemberRowToMember);
}

export async function getWorkspaceMember(workspaceId: string, userId: string): Promise<WorkspaceMember | null> {
  const { data, error } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function getDefaultProduct(workspaceId: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('workspace_id', workspaceId)
    .limit(1)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function getProducts(workspaceId: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at');
  if (error) throw error;
  return (data ?? []).map(mapProductRowToProduct);
}

export async function createProduct(workspaceId: string, name: string, slug: string, description?: string) {
  const { error } = await supabase
    .from('products')
    .insert({ workspace_id: workspaceId, name, slug, description });
  if (error) throw error;
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

export async function acceptInvite(tokenHash: string) {
    const { data, error } = await supabase.rpc('accept_invite', { 
        p_token_hash: tokenHash 
    });
    if (error) throw error;
    return data;
}

export async function removeMember(workspaceId: string, userId: string) {
    const { error } = await supabase.rpc('remove_workspace_member', {
        p_workspace_id: workspaceId,
        p_user_id: userId,
    });
    if (error) throw error;
}

export async function updateMemberRole(workspaceId: string, userId: string, role: string) {
    const { error } = await supabase.rpc('change_member_role', {
        p_workspace_id: workspaceId,
        p_user_id: userId,
        p_new_role: role,
    });
    if (error) throw error;
}

export async function getMyInvites(email: string) {
    const { data, error } = await supabase
        .from('workspace_invites')
        .select('*')
        .eq('email', email)
        .eq('status', 'pending');
    if (error) throw error;
    return data ?? [];
}

export async function declineInvite(inviteId: string) {
    const { error } = await supabase
        .from('workspace_invites')
        .update({ status: 'expired' })
        .eq('id', inviteId);
    if (error) throw error;
}

export async function getInviteByToken(token: string) {
    const { data, error } = await supabase
        .from('workspace_invites')
        .select('*, workspaces(name)')
        .eq('token_hash', token)
        .eq('status', 'pending')
        .single();
    if (error) return null;
    return data;
}