import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createChange } from '@/shared/api/releases';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Select } from '@/shared/ui/Select';
import { useToast } from '@/shared/ui/Toast';
import { releaseKeys } from '@/shared/lib/queryKeys';

const schema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  category: z.enum(['feature', 'improvement', 'bugfix', 'security', 'breaking']),
});

type FormData = z.infer<typeof schema>;

interface CreateChangeFormProps {
  releaseId: string;
  position: number;
  onSuccess?: () => void;
}

export function CreateChangeForm({ releaseId, position, onSuccess }: CreateChangeFormProps) {
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { category: 'feature' },
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      createChange({
        release_id: releaseId,
        title: data.title,
        description: data.description,
        category: data.category,
        position,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: releaseKeys.changes(releaseId) });
      addToast('Change added', 'success');
      reset();
      onSuccess?.();
    },
    onError: (err) => addToast(err instanceof Error ? err.message : 'Failed to add change', 'error'),
  });

  return (
    <form onSubmit={handleSubmit((data) => mutation.mutate(data))}>
      <Input label="Title" {...register('title')} error={errors.title?.message} />
      <Input label="Description" {...register('description')} error={errors.description?.message} />
      <Select
        label="Category"
        options={[
          { value: 'feature', label: 'Feature' },
          { value: 'improvement', label: 'Improvement' },
          { value: 'bugfix', label: 'Bugfix' },
          { value: 'security', label: 'Security' },
          { value: 'breaking', label: 'Breaking' },
        ]}
        {...register('category')}
        error={errors.category?.message}
      />
      <Button type="submit" loading={mutation.isPending}>Add Change</Button>
    </form>
  );
}
