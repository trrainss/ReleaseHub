import { useQuery, useMutation, useQueryClient, skipToken } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getRelease, submitForReview, publishRelease, deleteRelease, getChanges, getReviewers, getComments, getActivity, restoreRejectedToDraft, unpublishRelease } from '@/shared/api/releases';
import { getWorkspaceMember } from '@/shared/api/workspaces';
import { useAuth } from '@/shared/hooks/useAuth';
import { Button } from '@/shared/ui/Button';
import { LoadingSpinner } from '@/shared/ui/LoadingSpinner';
import { ErrorMessage } from '@/shared/ui/ErrorMessage';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { Modal } from '@/shared/ui/Modal';
import { useToast } from '@/shared/ui/Toast';
import { releaseKeys, workspaceKeys } from '@/shared/lib/queryKeys';
import { ChangeList } from '@/features/changes/ChangeList';
import { CreateChangeForm } from '@/features/changes/CreateChangeForm';
import { ApprovalPanel } from '@/features/approvals/ApprovalPanel';
import { CommentSection } from '@/features/comments/CommentSection';
import { ActivityLog } from '@/features/comments/ActivityLog';
import { useRealtimeRelease } from '@/shared/hooks/useRealtimeSubscription';
import { AssignReviewers } from '@/features/approvals/AssignReviewers';
import { canPublish, canSubmitForReview, canDeleteRelease, canCreateChange, canDeleteChange } from '@/shared/lib/roles';
import { ConflictError } from '@/shared/lib/errors';

export function ReleaseDetail() {
  const { releaseId } = useParams<{ releaseId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCreateChange, setShowCreateChange] = useState(false);
  const [conflictError, setConflictError] = useState(false);

  const { data: release, isLoading, isError, error, refetch } = useQuery({
    queryKey: releaseId ? releaseKeys.detail(releaseId) : ['skip'],
    queryFn: releaseId ? () => getRelease(releaseId) : skipToken,
    enabled: !!releaseId,
  });

  const { data: membership } = useQuery({
    queryKey: workspaceKeys.members(release?.products?.workspace_id ?? ''),
    queryFn: async () => {
      if (!release?.products?.workspace_id || !user) return null;
      return getWorkspaceMember(release.products.workspace_id, user.id);
    },
    enabled: !!release && !!user && !!release.products?.workspace_id,
  });

  const { data: changes } = useQuery({
    queryKey: releaseKeys.changes(releaseId!),
    queryFn: () => getChanges(releaseId!),
    enabled: !!releaseId,
  });

  const { data: reviewers } = useQuery({
    queryKey: releaseKeys.reviewers(releaseId!),
    queryFn: () => getReviewers(releaseId!),
    enabled: !!releaseId,
  });

  const { data: comments } = useQuery({
    queryKey: releaseKeys.comments(releaseId!),
    queryFn: () => getComments(releaseId!),
    enabled: !!releaseId,
  });

  const { data: activity } = useQuery({
    queryKey: releaseKeys.activity(releaseId!),
    queryFn: () => getActivity(releaseId!),
    enabled: !!releaseId,
  });

  const { deletedRemotely, resetDeleted } = useRealtimeRelease(releaseId);

  const userRole = membership?.role ?? null;
  const canSubmit = userRole ? canSubmitForReview(userRole) : false;
  const canPublishAction = userRole ? canPublish(userRole) : false;
  const canAddChange = userRole ? canCreateChange(userRole) : false;

  // --- useMutation: Submit for Review ---
  const submitMutation = useMutation({
    mutationFn: ({ releaseId, reviewerIds }: { releaseId: string; reviewerIds: string[] }) => {
      if (!reviewerIds || reviewerIds.length === 0) {
        throw new Error('Assign at least one reviewer before submitting');
      }
      return submitForReview(releaseId, reviewerIds);
    },
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: releaseKeys.detail(variables.releaseId) }),
        queryClient.invalidateQueries({ queryKey: releaseKeys.activity(variables.releaseId) }),
      ]);
      addToast('Release submitted for review', 'success');
    },
    onError: (err) => {
      if (err instanceof ConflictError) {
        setConflictError(true);
      }
      addToast(err instanceof Error ? err.message : 'Failed to submit', 'error');
    },
  });

  // --- useMutation: Publish ---
  const publishMutation = useMutation({
    mutationFn: (releaseId: string) => publishRelease(releaseId),
    onSuccess: async () => {
      if (!release) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: releaseKeys.detail(release.id) }),
        queryClient.invalidateQueries({ queryKey: releaseKeys.activity(release.id) }),
      ]);
      addToast('Release published', 'success');
    },
    onError: (err) => {
      if (err instanceof ConflictError) {
        setConflictError(true);
      }
      addToast(err instanceof Error ? err.message : 'Failed to publish', 'error');
    },
  });

  // --- useMutation: Delete ---
  const deleteMutation = useMutation({
    mutationFn: (releaseId: string) => deleteRelease(releaseId),
    onSuccess: () => {
      addToast('Release deleted', 'success');
      navigate(-1);
    },
    onError: (err) => {
      addToast(err instanceof Error ? err.message : 'Failed to delete', 'error');
    },
  });

  // --- useMutation: Restore to Draft ---
  const restoreMutation = useMutation({
    mutationFn: (releaseId: string) => restoreRejectedToDraft(releaseId),
    onSuccess: async () => {
      if (!release) return;
      await queryClient.invalidateQueries({ queryKey: releaseKeys.detail(release.id) });
      addToast('Release restored to draft', 'success');
    },
    onError: (err) => {
      addToast(err instanceof Error ? err.message : 'Failed to restore', 'error');
    },
  });

  // --- useMutation: Unpublish ---
  const unpublishMutation = useMutation({
    mutationFn: (releaseId: string) => unpublishRelease(releaseId),
    onSuccess: async () => {
      if (!release) return;
      await queryClient.invalidateQueries({ queryKey: releaseKeys.detail(release.id) });
      addToast('Release unpublished', 'success');
    },
    onError: (err) => {
      addToast(err instanceof Error ? err.message : 'Failed to unpublish', 'error');
    },
  });

  // --- Side effects for deleted release (moved out of render) ---
  useEffect(() => {
    if (!deletedRemotely) return;
    resetDeleted();
    addToast('This release was deleted by another user', 'error');
    navigate(-1);
  }, [deletedRemotely, resetDeleted, addToast, navigate]);

  // --- Early returns (after all hooks) ---
  if (isLoading) return <LoadingSpinner size="lg" />;
  if (isError || !release) return <ErrorMessage message={error instanceof Error ? error.message : 'Release not found'} onRetry={refetch} />;
  if (deletedRemotely) {
    return null;
  }

  return (
    <div className="release-detail">
      {conflictError && (
        <div className="conflict-banner">
          <span>This release was modified by another user.</span>
          <Button size="sm" onClick={() => { refetch(); setConflictError(false); }}>
            Reload data
          </Button>
        </div>
      )}

      <div className="release-detail__header">
        <div>
          <h1>{release.title}</h1>
          <p className="release-detail__version">v{release.version}</p>
        </div>
        <span className={`status-badge status-badge--${release.status}`}>{release.status}</span>
      </div>

      {release.description && <p className="release-detail__description">{release.description}</p>}

      <div className="release-detail__actions">
        {release.status === 'draft' && canSubmit && (
          <Button onClick={() => submitMutation.mutate({ releaseId: release.id, reviewerIds: reviewers?.map(r => r.user_id) ?? [] })} loading={submitMutation.isPending}>
            Submit for Review
          </Button>
        )}

        {release.status === 'approved' && canPublishAction && (
          <Button onClick={() => publishMutation.mutate(release.id)} loading={publishMutation.isPending}>
            Publish Release
          </Button>
        )}

        {release.status === 'rejected' && canSubmit && (
          <Button onClick={() => restoreMutation.mutate(release.id)} loading={restoreMutation.isPending}>
            Restore to Draft
          </Button>
        )}

        {release.status === 'published' && userRole === 'owner' && (
          <Button variant="ghost" onClick={() => unpublishMutation.mutate(release.id)} loading={unpublishMutation.isPending}>
            Unpublish
          </Button>
        )}

        {release.status === 'draft' && userRole !== null && canDeleteRelease(userRole) && (
          <Button variant="danger" onClick={() => setShowDeleteConfirm(true)} loading={deleteMutation.isPending}>
            Delete Release
          </Button>
        )}
      </div>

      <div className="release-detail__sections">
        <section>
          <h2>Changes</h2>
          {changes && <ChangeList
            changes={changes}
            releaseId={release.id}
            status={release.status}
            canDeleteChange={(change) =>
              userRole !== null &&
              canDeleteChange(userRole, change.created_by === user?.id, release.status)
            }
          />}
          {release.status === 'draft' && canAddChange && (
            <Button size="sm" onClick={() => setShowCreateChange(true)}>Add Change</Button>
          )}
        </section>

        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-base)' }}>
            <h2>Reviewers & Approval</h2>
            {release.status === 'draft' && canSubmit && (
              <AssignReviewers
                releaseId={release.id}
                workspaceId={release.products?.workspace_id ?? ''}
                currentReviewers={reviewers?.map(r => r.user_id) ?? []}
                onAssigned={() => {
                    queryClient.invalidateQueries({ queryKey: releaseKeys.reviewers(release.id) });
                }}
            />
            )}
          </div>
          {reviewers && (
            <ApprovalPanel
              releaseId={release.id}
              reviewers={reviewers}
              status={release.status}
            />
          )}
        </section>

        <section>
          <h2>Comments</h2>
          {comments && <CommentSection releaseId={release.id} comments={comments} />}
        </section>

        <section>
          <h2>Activity</h2>
          {activity && <ActivityLog events={activity} />}
        </section>
      </div>

      <Modal open={showCreateChange} onClose={() => setShowCreateChange(false)} title="Add Change">
        <CreateChangeForm
          releaseId={release.id}
          position={(changes?.length ?? 0) + 1}
          onSuccess={() => {
            setShowCreateChange(false);
          }}
        />
      </Modal>

      <ConfirmDialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => deleteMutation.mutate(release.id)}
        title="Delete Release"
        message="Are you sure you want to delete this release? This cannot be undone."
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
