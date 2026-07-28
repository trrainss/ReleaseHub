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
        <form onSubmit={handleSubmit} className="invite-form">
            <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                disabled={mutation.isPending}
            />
            <div className="input-group">
                <label className="input-group__label">Role</label>
                <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    disabled={mutation.isPending}
                    className="input"
                >
                    <option value="contributor">Contributor</option>
                    <option value="maintainer">Maintainer</option>
                    <option value="owner">Owner</option>
                </select>
            </div>
            {error && (
                <p className="input-group__error">{error}</p>
            )}
            <div className="modal__actions">
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