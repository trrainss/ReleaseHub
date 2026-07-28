import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createWorkspace } from '@/shared/api/workspaces';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { useToast } from '@/shared/ui/Toast';
import { workspaceKeys } from '@/shared/lib/queryKeys';
import { useAuth } from '@/shared/hooks/useAuth';

const schema = z.object({
  name: z.string().min(1, 'Workspace name is required'),
});

type FormData = z.infer<typeof schema>;

interface CreateWorkspaceFormProps {
  onSuccess?: () => void;
}

export function CreateWorkspaceForm({ onSuccess }: CreateWorkspaceFormProps) {
  const { user } = useAuth(); // ← получаем пользователя
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      // Проверяем, что пользователь авторизован
      if (!user) {
        throw new Error('You must be logged in to create a workspace');
      }
      
      console.log(' Creating workspace:', { 
        name: data.name, 
        userId: user.id 
      });
      
      // Передаем name и userId
      return createWorkspace(data.name, user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.list() });
      addToast('Workspace created', 'success');
      reset();
      onSuccess?.();
    },
    onError: (err) => {
      console.error(' Create error:', err);
      addToast(err instanceof Error ? err.message : 'Failed to create workspace', 'error');
    },
  });

  return (
    <form onSubmit={handleSubmit((data) => mutation.mutate(data))}>
      <Input
        label="Workspace Name"
        {...register('name')}
        error={errors.name?.message}
      />
      {!user && (
        <p className="input-group__error">
           Please login to create a workspace
        </p>
      )}
      <Button 
        type="submit" 
        loading={mutation.isPending}
        disabled={!user}
      >
        Create Workspace
      </Button>
    </form>
  );
}