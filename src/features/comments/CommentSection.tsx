import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createComment, deleteComment } from '@/shared/api/releases';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/Toast';
import { useAuth } from '@/shared/hooks/useAuth';
import { releaseKeys } from '@/shared/lib/queryKeys';
import type { Comment } from '@/shared/types';

const commentSchema = z.object({
  content: z.string().min(1, 'Comment cannot be empty'),
});

type CommentFormData = z.infer<typeof commentSchema>;

interface CommentSectionProps {
  releaseId: string;
  comments: (Comment & { profile: { display_name: string; avatar_url: string | null } })[];
}

export function CommentSection({ releaseId, comments }: CommentSectionProps) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CommentFormData>({
    resolver: zodResolver(commentSchema),
  });

  const createMutation = useMutation({
    mutationFn: (data: CommentFormData) => createComment(releaseId, user!.id, data.content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: releaseKeys.comments(releaseId) });
      reset();
      addToast('Comment added', 'success');
    },
    onError: (err) => addToast(err instanceof Error ? err.message : 'Failed to add comment', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteComment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: releaseKeys.comments(releaseId) });
      addToast('Comment deleted', 'success');
    },
    onError: (err) => addToast(err instanceof Error ? err.message : 'Failed to delete comment', 'error'),
  });

  return (
    <div className="comment-section">
      <form onSubmit={handleSubmit((data) => createMutation.mutate(data))} className="comment-section__input">
        <textarea
          className="input"
          placeholder="Write a comment..."
          {...register('content')}
          rows={3}
        />
        {errors.content && <p className="input-group__error">{errors.content.message}</p>}
        <Button
          type="submit"
          loading={createMutation.isPending}
          disabled={createMutation.isPending}
        >
          Send
        </Button>
      </form>
      <div className="comment-section__list">
        {comments.map((comment) => (
          <div key={comment.id} className="comment">
            <div className="comment__header">
              <span className="comment__author">{comment.profile.display_name}</span>
              <span className="comment__date">{new Date(comment.created_at).toLocaleString()}</span>
              {(user?.id === comment.user_id) && (
                <button
                  className="comment__delete"
                  onClick={() => deleteMutation.mutate(comment.id)}
                  aria-label="Delete comment"
                >
                  &times;
                </button>
              )}
            </div>
            <p className="comment__content">{comment.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
