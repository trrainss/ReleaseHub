import { useMutation, useQueryClient } from '@tanstack/react-query';
import { approveRelease, rejectRelease } from '@/shared/api/releases';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/Toast';
import { releaseKeys } from '@/shared/lib/queryKeys';
import { useAuth } from '@/shared/hooks/useAuth';
import type { ReleaseReviewer, ReleaseStatus } from '@/shared/types';

interface ApprovalPanelProps {
  releaseId: string;
  reviewers: (ReleaseReviewer & { profile: { display_name: string; avatar_url: string | null } })[];
  status: ReleaseStatus;
}

export function ApprovalPanel({ releaseId, reviewers, status }: ApprovalPanelProps) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const approveMutation = useMutation({
    mutationFn: () => approveRelease(releaseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: releaseKeys.detail(releaseId) });
      queryClient.invalidateQueries({ queryKey: releaseKeys.reviewers(releaseId) });
      queryClient.invalidateQueries({ queryKey: releaseKeys.activity(releaseId) });
      addToast('Release approved', 'success');
    },
    onError: (err) => addToast(err instanceof Error ? err.message : 'Failed to approve', 'error'),
  });

  const rejectMutation = useMutation({
    mutationFn: () => rejectRelease(releaseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: releaseKeys.detail(releaseId) });
      queryClient.invalidateQueries({ queryKey: releaseKeys.reviewers(releaseId) });
      queryClient.invalidateQueries({ queryKey: releaseKeys.activity(releaseId) });
      addToast('Release rejected', 'success');
    },
    onError: (err) => addToast(err instanceof Error ? err.message : 'Failed to reject', 'error'),
  });

  const isReviewer = reviewers?.some((r) => r.user_id === user?.id);
  const canAct = status === 'review' && isReviewer;

  return (
    <div className="approval-panel">
      {reviewers?.map((reviewer) => (
        <div key={reviewer.id} className="approval-panel__reviewer">
          <span>{reviewer.profile.display_name}</span>
          {reviewer.decision === 'approve' && <span className="badge badge--success">Approved</span>}
          {reviewer.decision === 'reject' && <span className="badge badge--danger">Rejected</span>}
          {!reviewer.decision && <span className="badge badge--pending">Pending</span>}
        </div>
      ))}
      {canAct && (
        <div className="approval-panel__actions">
          <Button
            variant="primary"
            onClick={() => approveMutation.mutate()}
            loading={approveMutation.isPending}
            disabled={rejectMutation.isPending}
          >
            Approve
          </Button>
          <Button
            variant="danger"
            onClick={() => rejectMutation.mutate()}
            loading={rejectMutation.isPending}
            disabled={approveMutation.isPending}
          >
            Reject
          </Button>
        </div>
      )}
    </div>
  );
}
