import { useQuery } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/shared/ui/Button';
import { LoadingSpinner } from '@/shared/ui/LoadingSpinner';
import { useAuth } from '@/shared/hooks/useAuth';
import { useToast } from '@/shared/ui/Toast';
import { getInviteByToken, acceptInvite } from '@/shared/api/workspaces';
import { inviteKeys } from '@/shared/lib/queryKeys';
import { inviteDataSchema } from '@/shared/lib/schemas';
import { skipToken } from '@tanstack/react-query';

export function AcceptInvitePage() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();
    const { user } = useAuth();
    const { addToast } = useToast();

    const inviteQuery = useQuery({
        queryKey: token ? inviteKeys.byToken(token) : [],
        queryFn: token ? () => getInviteByToken(token) : skipToken,
        enabled: !!token,
    });

    const acceptMutation = useMutation({
        mutationFn: (t: string) => acceptInvite(t),
        onSuccess: () => {
            addToast('Successfully joined the workspace!', 'success');
            navigate('/workspaces');
        },
        onError: (err: Error) => {
            addToast(err.message || 'Failed to accept invite', 'error');
        },
    });

    const handleAccept = () => {
        if (!user) {
            navigate('/auth/signin?redirect=' + encodeURIComponent(window.location.pathname + window.location.search));
            return;
        }
        if (token) acceptMutation.mutate(token);
    };

    const inviteData = inviteQuery.data ?? null;
    const hasError = inviteQuery.isError || !token;

    if (hasError) {
        return (
            <div className="auth-page">
                <div className="auth-form" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', marginBottom: 'var(--space-lg)', opacity: 0.5 }}>!</div>
                    <h1 className="auth-form__title">Invalid Invite</h1>
                    <p className="auth-form__subtitle">
                        {inviteQuery.error instanceof Error ? inviteQuery.error.message : (token ? 'Invite is invalid or expired' : 'Invalid invite link')}
                    </p>
                    <Button onClick={() => navigate('/workspaces')} className="auth-form__submit">
                        Go to Workspaces
                    </Button>
                </div>
            </div>
        );
    }

    if (!inviteData) {
        return (
            <div className="auth-page">
                <LoadingSpinner size="lg" />
            </div>
        );
    }

    const validatedInvite = inviteDataSchema.parse(inviteData);

    return (
        <div className="auth-page">
            <div className="auth-form">
                <div style={{ textAlign: 'center', marginBottom: 'var(--space-2xl)' }}>
                    <h1 className="auth-form__title">Join Workspace</h1>
                    <p className="auth-form__subtitle">
                        You've been invited to join <strong>{validatedInvite.workspaces?.name || 'a workspace'}</strong>
                    </p>
                    <p className="auth-form__subtitle" style={{ marginTop: 'var(--space-xs)', color: 'var(--color-text-tertiary)', fontSize: '0.8125rem' }}>
                        Role: <strong style={{ color: 'var(--color-primary)' }}>{validatedInvite.role}</strong>
                    </p>
                </div>

                {!user ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                        <p className="auth-form__subtitle">
                            Please sign in to accept this invitation
                        </p>
                        <Button 
                            onClick={() => navigate('/auth/signin?redirect=' + encodeURIComponent(window.location.pathname + window.location.search))}
                            className="auth-form__submit"
                        >
                            Sign In
                        </Button>
                        <Button 
                            variant="ghost" 
                            onClick={() => navigate('/auth/signup')}
                        >
                            Create Account
                        </Button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                        <p className="auth-form__subtitle">
                            You are signed in as <strong>{user.email}</strong>
                        </p>
                        <Button 
                            onClick={handleAccept}
                            loading={acceptMutation.isPending}
                            className="auth-form__submit"
                        >
                            Accept Invitation
                        </Button>
                        <Button 
                            variant="ghost" 
                            onClick={() => navigate('/workspaces')}
                        >
                            Cancel
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}