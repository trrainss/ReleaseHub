import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { inviteMember } from '@/shared/api/workspaces';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { useToast } from '@/shared/ui/Toast';

interface InviteFormProps {
    workspaceId: string;
    onSuccess?: () => void;
}

export function InviteForm({ workspaceId, onSuccess }: InviteFormProps) {
    const { addToast } = useToast();
    const queryClient = useQueryClient();
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('contributor');
    const [error, setError] = useState('');

    const mutation = useMutation({
        mutationFn: async () => {
            console.log('🔵 Sending invite:', { workspaceId, email, role });
            
            if (!email.trim()) {
                throw new Error('Email is required');
            }
            
            return await inviteMember(workspaceId, email.trim(), role);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['invites', workspaceId] });
            addToast('Invite sent successfully', 'success');
            setEmail('');
            onSuccess?.();
        },
        onError: (err: any) => {
            console.error('🔴 Invite error:', err);
            setError(err.message || 'Failed to send invite');
            addToast(err.message || 'Failed to send invite', 'error');
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        mutation.mutate();
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email address"
                    disabled={mutation.isPending}
                    className="w-full"
                />
            </div>
            <div>
                <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    disabled={mutation.isPending}
                    className="w-full border rounded px-3 py-2"
                >
                    <option value="contributor">Contributor</option>
                    <option value="maintainer">Maintainer</option>
                    <option value="owner">Owner</option>
                </select>
            </div>
            {error && (
                <p className="text-red-500 text-sm">{error}</p>
            )}
            <div className="flex gap-2">
                <Button
                    type="submit"
                    disabled={mutation.isPending}
                    loading={mutation.isPending}
                >
                    Send Invite
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    onClick={onSuccess}
                    disabled={mutation.isPending}
                >
                    Cancel
                </Button>
            </div>
        </form>
    );
}