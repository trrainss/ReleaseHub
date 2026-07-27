import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from '@/shared/hooks/useAuth';
import { ToastProvider } from '@/shared/ui/Toast';
import { queryClient } from '@/app/queryClient';
import { router } from '@/app/router';

export function Providers() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
