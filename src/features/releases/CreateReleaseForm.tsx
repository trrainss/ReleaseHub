import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createRelease } from '@/shared/api/releases';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { useToast } from '@/shared/ui/Toast';
import { releaseKeys } from '@/shared/lib/queryKeys';
import { z } from 'zod';

// Mirrors createReleaseSchema constraints (without productId set by caller).
// Keeping this in sync with the shared schema is manual — if constraints change, update here too.
const formSchema = z.object({
  version: z.string().min(1, 'Version is required').max(50),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).optional(),
  plannedAt: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface CreateReleaseFormProps {
  productId: string;
  onSuccess?: () => void;
}

export function CreateReleaseForm({ productId, onSuccess }: CreateReleaseFormProps) {
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { version: '', title: '', description: '', plannedAt: '' },
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      createRelease({
        productId,
        version: data.version,
        title: data.title,
        description: data.description,
        plannedAt: data.plannedAt,
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
      <Input label="Planned Date" type="date" {...register('plannedAt')} />
      <Button type="submit" loading={mutation.isPending}>Create Release</Button>
    </form>
  );
}
