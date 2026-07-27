import { useQuery } from '@tanstack/react-query';
import { useParams, Routes, Route, Link, NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { getWorkspace, getWorkspaceMember, getProducts } from '@/shared/api/workspaces';
import { useAuth } from '@/shared/hooks/useAuth';
import { LoadingSpinner } from '@/shared/ui/LoadingSpinner';
import { ErrorMessage } from '@/shared/ui/ErrorMessage';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import { CreateWorkspaceForm } from '@/features/workspaces/CreateWorkspaceForm';
import { ReleaseList } from '@/features/releases/ReleaseList';
import { MemberList } from '@/features/members/MemberList';
import { InviteForm } from '@/features/members/InviteForm';
import { workspaceKeys } from '@/shared/lib/queryKeys';
import { canManageMembers, canManageWorkspace } from '@/shared/lib/roles';
import type { Role } from '@/shared/types';

export function WorkspacePage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showInvite, setShowInvite] = useState(false);

  const { data: workspace, isLoading: wsLoading, isError: wsError, error: wsErrorData, refetch: wsRefetch } = useQuery({
    queryKey: workspaceKeys.detail(workspaceId!),
    queryFn: () => getWorkspace(workspaceId!),
    enabled: !!workspaceId,
  });

  const { data: membership } = useQuery({
    queryKey: [...workspaceKeys.members(workspaceId!), user?.id],
    queryFn: () => getWorkspaceMember(workspaceId!, user!.id),
    enabled: !!workspaceId && !!user,
  });

  const { data: products } = useQuery({
    queryKey: workspaceKeys.products(workspaceId!),
    queryFn: () => getProducts(workspaceId!),
    enabled: !!workspaceId,
  });

  const userRole = (membership?.role as Role) ?? null;
  const defaultProduct = products?.[0];
  const canManage = canManageMembers(userRole as Role);
  const canManageWs = canManageWorkspace(userRole as Role);

  if (wsLoading) return <LoadingSpinner size="lg" />;
  if (wsError || !workspace) return <ErrorMessage message={wsErrorData instanceof Error ? wsErrorData.message : 'Workspace not found or access denied'} onRetry={wsRefetch} />;

  if (!membership) {
    return <ErrorMessage message="You don't have access to this workspace." />;
  }

  return (
    <div className="page">
      <header className="page__header">
        <div>
          <Link to="/workspaces" className="back-link">&larr; Workspaces</Link>
          <h1>{workspace.name}</h1>
        </div>
        <div className="page__header-actions">
          {canManage && (
            <Button onClick={() => setShowInvite(true)}>Invite Member</Button>
          )}
          <Button variant="ghost" onClick={() => navigate('/workspaces')}>
            All Workspaces
          </Button>
        </div>
      </header>

      <nav className="tabs">
<NavLink to={`/workspaces/${workspaceId}/releases`} className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>Releases</NavLink>
          <NavLink to={`/workspaces/${workspaceId}/members`} className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>Members</NavLink>
          <NavLink to={`/workspaces/${workspaceId}/activity`} className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>Activity</NavLink>
          {canManageWs && <NavLink to={`/workspaces/${workspaceId}/settings`} className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>Settings</NavLink>}
      </nav>

      <Routes>
        <Route index element={
          defaultProduct ? (
            <ReleaseList productId={defaultProduct.id} />
          ) : (
            <p>No products found in this workspace.</p>
          )
        } />
        <Route path="releases" element={
          defaultProduct ? (
            <ReleaseList productId={defaultProduct.id} />
          ) : (
            <p>No products found.</p>
          )
        } />
        <Route path="members" element={
          <div>
            <MemberList workspaceId={workspaceId!} userRole={userRole as Role} />
          </div>
        } />
        <Route path="activity" element={<p>Activity log coming soon...</p>} />
        <Route path="settings" element={
          canManageWs ? (
            <div>
              <h2>Settings</h2>
              <CreateWorkspaceForm />
            </div>
          ) : <ErrorMessage message="Access denied" />
        } />
      </Routes>

      <Modal open={showInvite} onClose={() => setShowInvite(false)} title="Invite Member">
        <InviteForm workspaceId={workspaceId!} />
      </Modal>
    </div>
  );
}
