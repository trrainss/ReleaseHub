import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import { Button } from '@/shared/ui/Button';
import { LoadingSpinner } from '@/shared/ui/LoadingSpinner';
import { useAuth } from '@/shared/hooks/useAuth';
import { useToast } from '@/shared/ui/Toast';

export function AcceptInvitePage() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();
    const { user } = useAuth();
    const { addToast } = useToast();
    const [inviteData, setInviteData] = useState<any>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!token) {
            setError('Invalid invite link');
            return;
        }

        const checkInvite = async () => {
            const { data, error } = await supabase
                .from('workspace_invites')
                .select('*, workspaces(name)')
                .eq('token_hash', token)
                .eq('status', 'pending')
                .single();

            if (error || !data) {
                setError('Invite is invalid or expired');
                return;
            }

            setInviteData(data);
        };

        checkInvite();
    }, [token]);

    const acceptMutation = useMutation({
        mutationFn: async () => {
            const { error } = await supabase.rpc('accept_invite', {
                p_token_hash: token,
            });
            if (error) throw error;
        },
        onSuccess: () => {
            addToast('Successfully joined the workspace!', 'success');
            navigate('/workspaces');
        },
        onError: (err: any) => {
            setError(err.message || 'Failed to accept invite');
            addToast(err.message || 'Failed to accept invite', 'error');
        },
    });

    const handleAccept = () => {
        if (!user) {
            navigate('/auth/signin?redirect=' + encodeURIComponent(window.location.pathname + window.location.search));
            return;
        }
        acceptMutation.mutate();
    };

    if (error) {
        return (
            <div className="auth-page">
                <div className="auth-form" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', marginBottom: 'var(--space-lg)', opacity: 0.5 }}>!</div>
                    <h1 className="auth-form__title">Invalid Invite</h1>
                    <p className="auth-form__subtitle">{error}</p>
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

    return (
        <div className="auth-page">
            <div className="auth-form">
                <div style={{ textAlign: 'center', marginBottom: 'var(--space-2xl)' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-lg)', opacity: 0.6 }}>🏢</div>
                    <h1 className="auth-form__title">Join Workspace</h1>
                    <p className="auth-form__subtitle">
                        You've been invited to join <strong>{inviteData.workspaces?.name || 'a workspace'}</strong>
                    </p>
                    <p className="auth-form__subtitle" style={{ marginTop: 'var(--space-xs)', color: 'var(--color-text-tertiary)', fontSize: '0.8125rem' }}>
                        Role: <strong style={{ color: 'var(--color-primary)' }}>{inviteData.role}</strong>
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