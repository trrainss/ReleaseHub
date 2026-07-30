import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { inviteMember } from '@/shared/api/workspaces';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Select } from '@/shared/ui/Select';
import { useToast } from '@/shared/ui/Toast';

const inviteSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email format'),
  role: z.enum(['contributor', 'maintainer', 'owner']),
});

type InviteFormData = z.infer<typeof inviteSchema>;

interface InviteFormProps {
    workspaceId: string;
    onSuccess?: () => void;
}

export function InviteForm({ workspaceId, onSuccess }: InviteFormProps) {
    const { addToast } = useToast();
    const queryClient = useQueryClient();

    const { register, handleSubmit, formState: { errors }, reset } = useForm<InviteFormData>({
        resolver: zodResolver(inviteSchema),
        defaultValues: { role: 'contributor' },
    });

    const mutation = useMutation({
        mutationFn: async (data: InviteFormData) => {
            return await inviteMember(workspaceId, data.email.trim(), data.role);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['invites', workspaceId] });
            addToast('Invite sent successfully', 'success');
            reset();
            onSuccess?.();
        },
        onError: (err: Error) => {
            addToast(err.message || 'Failed to send invite', 'error');
        },
    });

    return (
        <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="invite-form">
            <Input
                type="email"
                label="Email"
                {...register('email')}
                error={errors.email?.message}
                disabled={mutation.isPending}
                placeholder="Email address"
            />
            <Select
                label="Role"
                options={[
                    { value: 'contributor', label: 'Contributor' },
                    { value: 'maintainer', label: 'Maintainer' },
                    { value: 'owner', label: 'Owner' },
                ]}
                {...register('role')}
                error={errors.role?.message}
                disabled={mutation.isPending}
            />
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