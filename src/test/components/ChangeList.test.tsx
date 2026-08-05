import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/shared/ui/Toast';
import { ChangeList } from '@/features/changes/ChangeList';
import type { ReleaseChange } from '@/shared/types';

vi.mock('@/shared/lib/supabase', () => ({
  supabase: {},
}));

vi.mock('@/shared/api/releases', () => ({
  deleteChange: vi.fn(),
  reorderChanges: vi.fn(),
}));

const mockChanges: ReleaseChange[] = [
  {
    id: 'c1', release_id: 'r1', title: 'Change 1', description: 'Desc 1',
    category: 'feature', position: 1, created_by: 'u1',
    created_at: '2024-01-01', updated_at: '2024-01-01',
  },
  {
    id: 'c2', release_id: 'r1', title: 'Change 2', description: 'Desc 2',
    category: 'bugfix', position: 2, created_by: 'u1',
    created_at: '2024-01-01', updated_at: '2024-01-01',
  },
];

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{ui}</ToastProvider>
    </QueryClientProvider>,
  );
}

describe('ChangeList', () => {
  it('renders changes', () => {
    renderWithProviders(
      <ChangeList changes={mockChanges} releaseId="r1" status="draft" canDeleteChange={() => true} />,
    );
    expect(screen.getByText('Change 1')).toBeInTheDocument();
    expect(screen.getByText('Change 2')).toBeInTheDocument();
  });

  it('shows category badges', () => {
    renderWithProviders(
      <ChangeList changes={mockChanges} releaseId="r1" status="draft" canDeleteChange={() => true} />,
    );
    expect(screen.getByText('feature')).toBeInTheDocument();
    expect(screen.getByText('bugfix')).toBeInTheDocument();
  });
});
