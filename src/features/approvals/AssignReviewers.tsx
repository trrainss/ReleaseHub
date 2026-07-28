import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import { useToast } from '@/shared/ui/Toast';
import { releaseKeys } from '@/shared/lib/queryKeys';

interface AssignReviewersProps {
    releaseId: string;
    workspaceId: string;
    currentReviewers: string[];
    onAssigned?: () => void;
}

export function AssignReviewers({ releaseId, workspaceId, currentReviewers, onAssigned }: AssignReviewersProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [selected, setSelected] = useState<string[]>(currentReviewers);
    const { addToast } = useToast();
    const queryClient = useQueryClient();

    const { data: members, isLoading } = useQuery({
        queryKey: ['workspace-members', workspaceId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('workspace_members')
                .select(`
                    user_id,
                    role,
                    profiles:user_id (
                        display_name,
                        avatar_url
                    )
                `)
                .eq('workspace_id', workspaceId);
            if (error) throw error;
            return data || [];
        },
        enabled: !!workspaceId,
    });

    const assignMutation = useMutation({
        mutationFn: async (reviewerIds: string[]) => {
            await supabase
                .from('release_reviewers')
                .delete()
                .eq('release_id', releaseId);

            if (reviewerIds.length === 0) return;

            const { error } = await supabase
                .from('release_reviewers')
                .insert(reviewerIds.map(user_id => ({
                    release_id: releaseId,
                    user_id,
                })));

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: releaseKeys.reviewers(releaseId) });
            addToast('Reviewers assigned successfully', 'success');
            setIsOpen(false);
            onAssigned?.();
        },
        onError: (err) => {
            addToast(err instanceof Error ? err.message : 'Failed to assign reviewers', 'error');
        },
    });

    const handleSave = () => {
        assignMutation.mutate(selected);
    };

    const toggleUser = (userId: string) => {
        setSelected(prev =>
            prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        );
    };

    return (
        <>
            <Button 
                size="sm" 
                onClick={() => {
                    setSelected(currentReviewers);
                    setIsOpen(true);
                }}
            >
                {currentReviewers.length > 0 ? 'Edit Reviewers' : 'Add Reviewers'}
                <span style={{ marginLeft: '0.25rem', fontSize: '0.75rem', opacity: 0.7 }}>({currentReviewers.length})</span>
            </Button>

            <Modal open={isOpen} onClose={() => setIsOpen(false)} title="Assign Reviewers">
                <div className="modal-form">
                    <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-lg)' }}>
                        Select users who can approve or reject this release.
                    </p>

                    {isLoading ? (
                        <div style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--color-text-tertiary)' }}>
                            Loading members...
                        </div>
                    ) : (
                        <div style={{ maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: 'var(--space-lg)' }}>
                            {members?.map((member: any) => (
                                <label
                                    key={member.user_id}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 'var(--space-md)',
                                        padding: 'var(--space-sm) var(--space-md)',
                                        borderRadius: 'var(--radius-sm)',
                                        cursor: 'pointer',
                                        transition: 'background var(--transition-fast)',
                                    }}
                                    className="reviewer-option"
                                >
                                    <input
                                        type="checkbox"
                                        checked={selected.includes(member.user_id)}
                                        onChange={() => toggleUser(member.user_id)}
                                        style={{ width: '1rem', height: '1rem', accentColor: 'var(--color-primary)' }}
                                    />
                                    <span>{member.profiles?.display_name || 'Unknown'}</span>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginLeft: 'auto' }}>({member.role})</span>
                                </label>
                            ))}
                            {members?.length === 0 && (
                                <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.875rem', textAlign: 'center', padding: 'var(--space-lg)' }}>
                                    No members found in this workspace.
                                </p>
                            )}
                        </div>
                    )}

                    <div className="modal__actions">
                        <Button
                            onClick={handleSave}
                            loading={assignMutation.isPending}
                            disabled={assignMutation.isPending}
                        >
                            Save Reviewers
                        </Button>
                        <Button variant="ghost" onClick={() => setIsOpen(false)}>
                            Cancel
                        </Button>
                    </div>
                </div>
            </Modal>

            <style>{`
                .reviewer-option:hover {
                    background: var(--color-surface-hover);
                }
            `}</style>
        </>
    );
}