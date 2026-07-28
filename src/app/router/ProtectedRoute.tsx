import { Navigate } from 'react-router-dom';
import { useAuth } from '@/shared/hooks/useAuth';
import { LoadingSpinner } from '@/shared/ui/LoadingSpinner';
import type { ReactNode } from 'react';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSpinner size="lg" />;
  

  if (!user) return <Navigate to="/auth/signin" replace />;

  return <>{children}</>;
}