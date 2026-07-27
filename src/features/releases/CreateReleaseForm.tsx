import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createRelease } from '@/shared/api/releases';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { useToast } from '@/shared/ui/Toast';
import { releaseKeys } from '@/shared/lib/queryKeys';

const schema = z.object({
  product_id: z.string().min(1),
  version: z.string().min(1, 'Version is required'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  planned_at: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface CreateReleaseFormProps {
  productId: string;
  createdBy: string;
  onSuccess?: () => void;
}

export function CreateReleaseForm({ productId, createdBy, onSuccess }: CreateReleaseFormProps) {
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { product_id: productId },
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      createRelease({
        product_id: data.product_id,
        version: data.version,
        title: data.title,
        description: data.description ?? null,
        planned_at: data.planned_at ?? null,
        published_at: null,
        created_by: createdBy,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: releaseKeys.lists() });
      addToast('Release created', 'success');
      reset();
      onSuccess?.();
    },
    onError: (err) => addToast(err instanceof Error ? err.message : 'Failed to create release', 'error'),
  });

  return (
    <form onSubmit={handleSubmit((data) => mutation.mutate(data))}>
      <Input label="Title" {...register('title')} error={errors.title?.message} />
      <Input label="Version" {...register('version')} error={errors.version?.message} />
      <Input label="Description" {...register('description')} />
      <Input label="Planned Date" type="date" {...register('planned_at')} />
      <Button type="submit" loading={mutation.isPending}>Create Release</Button>
    </form>
  );
}
