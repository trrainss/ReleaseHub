import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/shared/ui/Toast';
import { Button } from '@/shared/ui/Button';
import { canManageMembers } from '@/shared/lib/roles';

vi.mock('@/shared/lib/supabase', () => ({
  supabase: {},
}));

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{ui}</ToastProvider>
    </QueryClientProvider>,
  );
}

describe('Permission check - owner actions hidden from contributor', () => {
  it('contributor cannot manage members', () => {
    expect(canManageMembers('contributor')).toBe(false);
  });

  it('Invite button not rendered for contributor', () => {
    const role = 'contributor';
    renderWithProviders(
      <div>
        {canManageMembers(role) && <Button>Invite Member</Button>}
      </div>,
    );
    expect(screen.queryByText('Invite Member')).not.toBeInTheDocument();
  });
});
