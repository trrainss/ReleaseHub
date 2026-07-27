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

    // Получаем участников пространства
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

    // Мутация для сохранения согласующих
    const assignMutation = useMutation({
        mutationFn: async (reviewerIds: string[]) => {
            // Удаляем старых согласующих
            await supabase
                .from('release_reviewers')
                .delete()
                .eq('release_id', releaseId);

            // Добавляем новых
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
                <span className="ml-1 text-xs">({currentReviewers.length})</span>
            </Button>

            <Modal open={isOpen} onClose={() => setIsOpen(false)} title="Assign Reviewers">
                <div className="space-y-4">
                    <p className="text-sm text-gray-500">
                        Select users who can approve or reject this release.
                    </p>

                    {isLoading ? (
                        <div className="text-center py-4">Loading members...</div>
                    ) : (
                        <div className="max-h-60 overflow-y-auto space-y-1">
                            {members?.map((member: any) => (
                                <label
                                    key={member.user_id}
                                    className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                                >
                                    <input
                                        type="checkbox"
                                        checked={selected.includes(member.user_id)}
                                        onChange={() => toggleUser(member.user_id)}
                                        className="w-4 h-4"
                                    />
                                    <span>{member.profiles?.display_name || 'Unknown'}</span>
                                    <span className="text-xs text-gray-400">({member.role})</span>
                                </label>
                            ))}
                            {members?.length === 0 && (
                                <p className="text-gray-500 text-sm">No members found in this workspace.</p>
                            )}
                        </div>
                    )}

                    <div className="flex gap-2 pt-4 border-t">
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
        </>
    );
}