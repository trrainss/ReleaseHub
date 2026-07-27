import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import { Button } from '@/shared/ui/Button';
import { useAuth } from '@/shared/hooks/useAuth';
import { useToast } from '@/shared/ui/Toast';

export function AcceptInvitePage() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();
    const { user } = useAuth(); // убрали signIn
    const { addToast } = useToast();
    const [inviteData, setInviteData] = useState<any>(null);
    const [error, setError] = useState('');

    // Проверяем приглашение при загрузке
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
            // Если пользователь не авторизован, предлагаем войти
            navigate('/auth/signin?redirect=' + encodeURIComponent(window.location.pathname + window.location.search));
            return;
        }
        acceptMutation.mutate();
    };

    if (error) {
        return (
            <div className="flex justify-center items-center min-h-screen bg-gray-50">
                <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
                    <div className="text-red-500 text-5xl mb-4">❌</div>
                    <h2 className="text-xl font-semibold mb-2">Invalid Invite</h2>
                    <p className="text-gray-600 mb-4">{error}</p>
                    <Button onClick={() => navigate('/workspaces')}>Go to Workspaces</Button>
                </div>
            </div>
        );
    }

    if (!inviteData) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <div className="text-xl">Loading...</div>
            </div>
        );
    }

    return (
        <div className="flex justify-center items-center min-h-screen bg-gray-50">
            <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
                <div className="text-center mb-6">
                    <div className="text-5xl mb-4">🏢</div>
                    <h1 className="text-2xl font-bold">Join Workspace</h1>
                    <p className="text-gray-600 mt-2">
                        You've been invited to join <strong>{inviteData.workspaces?.name || 'a workspace'}</strong>
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                        Role: <span className="font-medium">{inviteData.role}</span>
                    </p>
                </div>

                {!user ? (
                    <div className="space-y-3">
                        <p className="text-gray-600 text-center">
                            Please sign in to accept this invitation
                        </p>
                        <Button 
                            onClick={() => navigate('/auth/signin?redirect=' + encodeURIComponent(window.location.pathname + window.location.search))}
                            className="w-full"
                        >
                            Sign In
                        </Button>
                        <Button 
                            variant="ghost" 
                            onClick={() => navigate('/auth/signup')}
                            className="w-full"
                        >
                            Create Account
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <p className="text-gray-600 text-center">
                            You are signed in as <strong>{user.email}</strong>
                        </p>
                        <Button 
                            onClick={handleAccept}
                            loading={acceptMutation.isPending}
                            className="w-full"
                        >
                            Accept Invitation
                        </Button>
                        <Button 
                            variant="ghost" 
                            onClick={() => navigate('/workspaces')}
                            className="w-full"
                        >
                            Cancel
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}