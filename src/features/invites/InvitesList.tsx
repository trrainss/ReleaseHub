import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/shared/hooks/useAuth';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/Toast';
import { LoadingSpinner } from '@/shared/ui/LoadingSpinner';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorMessage } from '@/shared/ui/ErrorMessage';
import { getMyInvites, acceptInvite, declineInvite } from '@/shared/api/workspaces';
import type { WorkspaceInvite } from '@/shared/types';

export function InvitesList() {
    const { user } = useAuth();
    const { addToast } = useToast();
    const queryClient = useQueryClient();

    const { data: invites, isLoading, error, refetch } = useQuery({
        queryKey: ['my-invites', user?.id],
        queryFn: () => getMyInvites(user!.email ?? ''),
        enabled: !!user,
    });

    const acceptMutation = useMutation({
        mutationFn: (tokenHash: string) => acceptInvite(tokenHash),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['my-invites', user?.id] });
            addToast('Invitation accepted!', 'success');
            refetch();
        },
        onError: (err: Error) => {
            addToast(err.message || 'Failed to accept invite', 'error');
        },
    });

    const declineMutation = useMutation({
        mutationFn: (inviteId: string) => declineInvite(inviteId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['my-invites', user?.id] });
            addToast('Invite declined', 'info');
            refetch();
        },
        onError: (err: Error) => {
            addToast(err.message || 'Failed to decline invite', 'error');
        },
    });

    if (isLoading) return <LoadingSpinner size="lg" />;

    if (error) {
        return <ErrorMessage message={error instanceof Error ? error.message : 'Failed to load invites'} onRetry={refetch} />;
    }

    if (!invites || invites.length === 0) {
        return (
            <EmptyState
                title="No pending invitations"
                description="You haven't been invited to any workspaces yet."
            />
        );
    }

    return (
        <div className="invites-list">
            {invites.map((invite: WorkspaceInvite) => (
                <div key={invite.id} className="invite-card">
                    <div className="invite-card__info">
                        <h3 className="invite-card__title">Workspace Invitation</h3>
                        <p className="invite-card__meta">
                            Role: <span className="invite-card__role">{invite.role}</span>
                        </p>
                        <p className="invite-card__meta">
                            Expires: {new Date(invite.expires_at).toLocaleDateString()}
                        </p>
                    </div>
                    <div className="invite-card__actions">
                        <Button
                            size="sm"
                            onClick={() => acceptMutation.mutate(invite.token_hash)}
                            loading={acceptMutation.isPending}
                        >
                            Accept
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => declineMutation.mutate(invite.id)}
                            loading={declineMutation.isPending}
                        >
                            Decline
                        </Button>
                    </div>
                </div>
            ))}
        </div>
    );
}