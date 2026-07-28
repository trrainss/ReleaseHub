import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { getRelease, submitForReview, publishRelease, deleteRelease, getChanges, getReviewers, getComments, getActivity } from '@/shared/api/releases';
import { useAuth } from '@/shared/hooks/useAuth';
import { Button } from '@/shared/ui/Button';
import { LoadingSpinner } from '@/shared/ui/LoadingSpinner';
import { ErrorMessage } from '@/shared/ui/ErrorMessage';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { Modal } from '@/shared/ui/Modal';
import { useToast } from '@/shared/ui/Toast';
import { releaseKeys } from '@/shared/lib/queryKeys';
import { ChangeList } from '@/features/changes/ChangeList';
import { CreateChangeForm } from '@/features/changes/CreateChangeForm';
import { ApprovalPanel } from '@/features/approvals/ApprovalPanel';
import { CommentSection } from '@/features/comments/CommentSection';
import { ActivityLog } from '@/features/comments/ActivityLog';
import { useRealtimeRelease } from '@/shared/hooks/useRealtimeSubscription';
import { AssignReviewers } from '@/features/approvals/AssignReviewers';

export function ReleaseDetail() {
  const { releaseId } = useParams<{ releaseId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCreateChange, setShowCreateChange] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const { data: release, isLoading, isError, error, refetch } = useQuery({
    queryKey: releaseKeys.detail(releaseId!),
    queryFn: () => getRelease(releaseId!),
    enabled: !!releaseId,
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

  useRealtimeRelease(releaseId!);

  if (isLoading) return <LoadingSpinner size="lg" />;
  if (isError || !release) return <ErrorMessage message={error instanceof Error ? error.message : 'Release not found'} onRetry={refetch} />;

  const handleSubmit = async () => {
    if (!reviewers?.length) {
      addToast('Assign at least one reviewer before submitting', 'error');
      return;
    }
    setSubmitLoading(true);
    try {
      await submitForReview(release.id, reviewers.map((r) => r.user_id));
      queryClient.invalidateQueries({ queryKey: releaseKeys.detail(release.id) });
      queryClient.invalidateQueries({ queryKey: releaseKeys.activity(release.id) });
      addToast('Release submitted for review', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to submit', 'error');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handlePublish = async () => {
    setPublishLoading(true);
    try {
      await publishRelease(release.id);
      queryClient.invalidateQueries({ queryKey: releaseKeys.detail(release.id) });
      queryClient.invalidateQueries({ queryKey: releaseKeys.activity(release.id) });
      addToast('Release published', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to publish', 'error');
    } finally {
      setPublishLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await deleteRelease(release.id);
      addToast('Release deleted', 'success');
      navigate(-1);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to delete', 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="release-detail">
      <div className="release-detail__header">
        <div>
          <h1>{release.title}</h1>
          <p className="release-detail__version">v{release.version}</p>
        </div>
        <span className={`status-badge status-badge--${release.status}`}>{release.status}</span>
      </div>

      {release.description && <p className="release-detail__description">{release.description}</p>}

      {release.status === 'draft' && (
        <Button onClick={handleSubmit} loading={submitLoading}>
          Submit for Review
        </Button>
      )}

      {release.status === 'approved' && (
        <Button onClick={handlePublish} loading={publishLoading}>
          Publish Release
        </Button>
      )}

      {release.status === 'draft' && (
        <Button variant="danger" onClick={() => setShowDeleteConfirm(true)}>
          Delete Release
        </Button>
      )}

      <div className="release-detail__sections">
        <section>
          <h2>Changes</h2>
          {changes && <ChangeList changes={changes} releaseId={release.id} status={release.status} />}
          {release.status === 'draft' && (
            <Button size="sm" onClick={() => setShowCreateChange(true)}>Add Change</Button>
          )}
        </section>

        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-base)' }}>
            <h2>Reviewers & Approval</h2>
            {release.status === 'draft' && (
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
          userId={user?.id ?? ''}
          position={(changes?.length ?? 0) + 1}
          onSuccess={() => setShowCreateChange(false)}
        />
      </Modal>

      <ConfirmDialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Release"
        message="Are you sure you want to delete this release? This cannot be undone."
        confirmLabel="Delete"
        loading={deleteLoading}
      />
    </div>
  );
}
