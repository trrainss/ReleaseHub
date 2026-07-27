import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/shared/ui/Toast';
import { CreateReleaseForm } from '@/features/releases/CreateReleaseForm';

vi.mock('@/shared/lib/supabase', () => ({
  supabase: {},
}));

vi.mock('@/shared/api/releases', () => ({
  createRelease: vi.fn().mockResolvedValue({ id: '1', title: 'Test Release', status: 'draft' }),
}));

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{ui}</ToastProvider>
    </QueryClientProvider>,
  );
}

describe('CreateReleaseForm', () => {
  it('renders form fields', () => {
    renderWithProviders(<CreateReleaseForm productId="p1" createdBy="u1" />);
    expect(screen.getByLabelText('Title')).toBeInTheDocument();
    expect(screen.getByLabelText('Version')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create release/i })).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    renderWithProviders(<CreateReleaseForm productId="p1" createdBy="u1" />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /create release/i }));
    await waitFor(() => {
      expect(screen.getByText('Title is required')).toBeInTheDocument();
      expect(screen.getByText('Version is required')).toBeInTheDocument();
    });
  });

  it('submits with valid data', async () => {
    const onSuccess = vi.fn();
    renderWithProviders(
      <CreateReleaseForm productId="p1" createdBy="u1" onSuccess={onSuccess} />,
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Title'), 'Test Release');
    await user.type(screen.getByLabelText('Version'), '1.0.0');
    await user.click(screen.getByRole('button', { name: /create release/i }));
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });
});
