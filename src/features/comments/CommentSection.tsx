import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createComment, deleteComment } from '@/shared/api/releases';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/Toast';
import { useAuth } from '@/shared/hooks/useAuth';
import { releaseKeys } from '@/shared/lib/queryKeys';
import type { Comment } from '@/shared/types';

interface CommentSectionProps {
  releaseId: string;
  comments: (Comment & { profile: { display_name: string; avatar_url: string | null } })[];
}

export function CommentSection({ releaseId, comments }: CommentSectionProps) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');

  const createMutation = useMutation({
    mutationFn: () => createComment(releaseId, user!.id, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: releaseKeys.comments(releaseId) });
      setContent('');
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
      <div className="comment-section__input">
        <textarea
          className="input"
          placeholder="Write a comment..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
        />
        <Button
          onClick={() => createMutation.mutate()}
          loading={createMutation.isPending}
          disabled={!content.trim()}
        >
          Send
        </Button>
      </div>
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
