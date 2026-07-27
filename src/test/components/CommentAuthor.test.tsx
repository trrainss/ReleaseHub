import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/shared/hooks/useAuth';
import { ToastProvider } from '@/shared/ui/Toast';
import { CommentSection } from '@/features/comments/CommentSection';
import type { Comment } from '@/shared/types';

vi.mock('@/shared/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}));

vi.mock('@/shared/api/releases', () => ({
  createComment: vi.fn(),
  deleteComment: vi.fn(),
}));

const mockComments = [
  {
    id: 'c1', release_id: 'r1', user_id: 'u1', content: 'Great release!',
    created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z',
    profile: { display_name: 'Alice', avatar_url: null },
  },
] as (Comment & { profile: { display_name: string; avatar_url: string | null } })[];

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider><ToastProvider>{ui}</ToastProvider></AuthProvider>
    </QueryClientProvider>,
  );
}

describe('CommentSection', () => {
  it('displays author name and avatar', () => {
    renderWithProviders(
      <CommentSection releaseId="r1" comments={mockComments} />,
    );
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Great release!')).toBeInTheDocument();
  });
});
