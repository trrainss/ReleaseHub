import { useQuery, useMutation, useQueryClient, skipToken } from '@tanstack/react-query';
import { useParams, Routes, Route, Link, NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { getWorkspace, getWorkspaceMember, getProducts, createProduct, updateWorkspace } from '@/shared/api/workspaces';
import { getWorkspaceActivity } from '@/shared/api/releases';
import { useAuth } from '@/shared/hooks/useAuth';
import { LoadingSpinner } from '@/shared/ui/LoadingSpinner';
import { ErrorMessage } from '@/shared/ui/ErrorMessage';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import { Input } from '@/shared/ui/Input';
import { useToast } from '@/shared/ui/Toast';
import { ReleaseList } from '@/features/releases/ReleaseList';
import { MemberList } from '@/features/members/MemberList';
import { InviteForm } from '@/features/members/InviteForm';
import { ActivityLog } from '@/features/comments/ActivityLog';
import { workspaceKeys } from '@/shared/lib/queryKeys';
import { canManageMembers, canManageWorkspace } from '@/shared/lib/roles';

export function WorkspacePage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [showInvite, setShowInvite] = useState(false);
  const [showCreateProduct, setShowCreateProduct] = useState(false);
  const [productForm, setProductForm] = useState({ name: '', slug: '', description: '' });
  const [editWorkspaceName, setEditWorkspaceName] = useState<string | undefined>(undefined);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const { data: workspace, isLoading: wsLoading, isError: wsError, error: wsErrorData, refetch: wsRefetch } = useQuery({
    queryKey: workspaceId ? workspaceKeys.detail(workspaceId) : workspaceKeys.detail('skip'),
    queryFn: workspaceId ? () => getWorkspace(workspaceId) : skipToken,
    enabled: !!workspaceId,
  });

  const { data: membership } = useQuery({
    queryKey: workspaceId && user ? workspaceKeys.member(workspaceId, user.id) : ['skip'],
    queryFn: workspaceId && user ? () => getWorkspaceMember(workspaceId, user.id) : skipToken,
    enabled: !!workspaceId && !!user,
  });

  const { data: products } = useQuery({
    queryKey: workspaceId ? workspaceKeys.products(workspaceId) : workspaceKeys.products('skip'),
    queryFn: workspaceId ? () => getProducts(workspaceId) : skipToken,
    enabled: !!workspaceId,
  });

  const { data: activity } = useQuery({
    queryKey: workspaceId ? workspaceKeys.activity(workspaceId) : workspaceKeys.activity('skip'),
    queryFn: workspaceId ? () => getWorkspaceActivity(workspaceId) : skipToken,
    enabled: !!workspaceId,
  });

  const userRole = membership?.role ?? null;
  const canManage = userRole !== null && canManageMembers(userRole);
  const canManageWs = userRole !== null && canManageWorkspace(userRole);

  // --- useMutation: Update workspace ---
  const updateWorkspaceMutation = useMutation({
    mutationFn: (name: string) => updateWorkspace(workspaceId!, { name }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.detail(workspaceId!) });
      addToast('Workspace updated', 'success');
    },
    onError: (err) => {
      addToast(err instanceof Error ? err.message : 'Failed to update workspace', 'error');
    },
  });

  // --- useMutation: Create product ---
  const createProductMutation = useMutation({
    mutationFn: (data: { name: string; slug: string; description?: string }) =>
      createProduct(workspaceId!, data.name, data.slug, data.description),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.products(workspaceId!) });
      addToast('Product created', 'success');
      setShowCreateProduct(false);
      setProductForm({ name: '', slug: '', description: '' });
    },
    onError: (err) => {
      addToast(err instanceof Error ? err.message : 'Failed to create product', 'error');
    },
  });

  // Determine active product
  const activeProduct = selectedProductId
    ? products?.find(p => p.id === selectedProductId)
    : products?.[0];

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
        <NavLink to={`/workspaces/${workspaceId}/products`} className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>Products</NavLink>
        <NavLink to={`/workspaces/${workspaceId}/members`} className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>Members</NavLink>
        <NavLink to={`/workspaces/${workspaceId}/activity`} className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>Activity</NavLink>
        {canManageWs && <NavLink to={`/workspaces/${workspaceId}/settings`} className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>Settings</NavLink>}
      </nav>

      <Routes>
        <Route index element={
          activeProduct ? (
            <ReleaseList productId={activeProduct.id} userRole={userRole ?? undefined} />
          ) : (
            <p>No products found in this workspace.</p>
          )
        } />
        <Route path="releases" element={
          activeProduct ? (
            <ReleaseList productId={activeProduct.id} userRole={userRole ?? undefined} />
          ) : (
            <p>No products found.</p>
          )
        } />
        <Route path="products" element={
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-base)' }}>
              <h2>Products</h2>
              {canManageWs && (
                <Button size="sm" onClick={() => setShowCreateProduct(true)}>+ New Product</Button>
              )}
            </div>
            {products?.length ? (
              <div className="workspace-list">
                {products.map((product) => (
                  <div key={product.id} className="workspace-card" style={{ cursor: 'pointer' }} onClick={() => setSelectedProductId(product.id)}>
                    <h3 className="workspace-card__name">{product.name}</h3>
                    <p className="workspace-card__meta">Slug: {product.slug}</p>
                    {product.description && <p>{product.description}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <p>No products yet. {canManageWs && 'Create one to get started.'}</p>
            )}
          </div>
        } />
        <Route path="members" element={
          <div>
            {userRole !== null ? (
              <MemberList workspaceId={workspaceId!} userRole={userRole} />
            ) : (
              <LoadingSpinner />
            )}
          </div>
        } />
        <Route path="activity" element={
          <div>
            <h2>Activity</h2>
            {activity ? <ActivityLog events={activity} /> : <LoadingSpinner />}
          </div>
        } />
        <Route path="settings" element={
          canManageWs ? (
            <div>
              <h2>Workspace Settings</h2>
              <form onSubmit={(e) => {
                e.preventDefault();
                const trimmed = (editWorkspaceName ?? workspace.name).trim();
                if (!trimmed) return;
                updateWorkspaceMutation.mutate(trimmed);
              }} className="modal-form">
                <Input
                  label="Workspace Name"
                  value={editWorkspaceName ?? workspace.name}
                  onChange={(e) => setEditWorkspaceName(e.target.value)}
                  onFocus={() => setEditWorkspaceName(prev => prev ?? workspace.name)}
                />
                <Button type="submit" loading={updateWorkspaceMutation.isPending}>Save Changes</Button>
              </form>
            </div>
          ) : <ErrorMessage message="Access denied" />
        } />
      </Routes>

      <Modal open={showInvite} onClose={() => setShowInvite(false)} title="Invite Member">
        <InviteForm workspaceId={workspaceId!} onSuccess={() => setShowInvite(false)} />
      </Modal>

      <Modal open={showCreateProduct} onClose={() => setShowCreateProduct(false)} title="Create Product">
        <form onSubmit={(e) => {
          e.preventDefault();
          const name = productForm.name.trim();
          const slug = productForm.slug.trim();
          if (!name || !slug) return;
          createProductMutation.mutate({ name, slug, description: productForm.description || undefined });
        }} className="modal-form">
          <Input
            label="Name"
            value={productForm.name}
            onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
            required
          />
          <Input
            label="Slug"
            value={productForm.slug}
            onChange={(e) => setProductForm({ ...productForm, slug: e.target.value })}
            placeholder="my-product"
            required
          />
          <Input
            label="Description"
            value={productForm.description}
            onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
          />
          <div className="modal__actions">
            <Button type="submit" loading={createProductMutation.isPending}>Create Product</Button>
            <Button type="button" variant="ghost" onClick={() => setShowCreateProduct(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
