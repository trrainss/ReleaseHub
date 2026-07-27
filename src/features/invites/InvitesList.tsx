import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import { useAuth } from '@/shared/hooks/useAuth';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/Toast';

export function InvitesList() {
    const { user } = useAuth();
    const { addToast } = useToast();
    const queryClient = useQueryClient();

    const { data: invites, isLoading, error, refetch } = useQuery({
        queryKey: ['my-invites', user?.id],
        queryFn: async () => {
            if (!user) return [];
            
            // Пробуем найти по email напрямую
            const { data, error } = await supabase
                .from('workspace_invites')
                .select('*')
                .eq('email', user.email)
                .eq('status', 'pending');

            if (error) {
                console.error('Error:', error);
                throw error;
            }
            
            console.log('Invites for email:', data);
            return data || [];
        },
        enabled: !!user,
    });

    const acceptMutation = useMutation({
        mutationFn: async (tokenHash: string) => {
            console.log('Calling accept_invite with token:', tokenHash);
            const { data, error } = await supabase.rpc('accept_invite', {
                p_token_hash: tokenHash,
            });
            if (error) {
                console.error('RPC error:', error);
                throw error;
            }
            console.log('Success:', data);
            return data;
        },
    
    });

    const declineMutation = useMutation({
        mutationFn: async (inviteId: string) => {
            const { error } = await supabase
                .from('workspace_invites')
                .update({ status: 'expired' })
                .eq('id', inviteId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['my-invites', user?.id] });
            addToast('Invite declined', 'info');
            refetch();
        },
        onError: (err: any) => {
            addToast(err.message || 'Failed to decline invite', 'error');
        },
    });

    if (isLoading) return <div>Loading invites...</div>;

    if (error) {
        console.error('Query error:', error);
        return <div className="text-red-500">Error loading invites</div>;
    }

    if (!invites || invites.length === 0) {
        return (
            <div className="text-center py-8 text-gray-500">
                <p className="text-lg">No pending invitations</p>
                <p className="text-sm">You haven't been invited to any workspaces yet.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-semibold">Pending Invitations</h2>
            {invites.map((invite: any) => (
                <div key={invite.id} className="bg-white p-4 rounded-lg shadow border">
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="font-semibold text-lg">
                                Workspace
                            </h3>
                            <p className="text-sm text-gray-600">
                                Role: <span className="font-medium">{invite.role}</span>
                            </p>
                            <p className="text-sm text-gray-500">
                                Expires: {new Date(invite.expires_at).toLocaleDateString()}
                            </p>
                        </div>
                        <div className="flex gap-2">
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
                                className="text-red-600 hover:bg-red-50"
                            >
                                Decline
                            </Button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}