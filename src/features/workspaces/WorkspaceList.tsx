import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getWorkspaces } from '@/shared/api/workspaces';
import { LoadingSpinner } from '@/shared/ui/LoadingSpinner';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorMessage } from '@/shared/ui/ErrorMessage';
import { workspaceKeys } from '@/shared/lib/queryKeys';

export function WorkspaceList() {
  const { data: workspaces, isLoading, isError, error, refetch } = useQuery({
    queryKey: workspaceKeys.list(),
    queryFn: getWorkspaces,
  });

  if (isLoading) return <LoadingSpinner size="lg" />;

  if (isError) {
    return <ErrorMessage message={error instanceof Error ? error.message : 'Failed to load workspaces'} onRetry={refetch} />;
  }

  if (!workspaces?.length) {
    return (
      <EmptyState
        title="No workspaces yet"
        description="Create your first workspace to get started."
      />
    );
  }

  return (
    <div className="workspace-list">
      {workspaces.map((ws) => (
        <Link key={ws.id} to={`/workspaces/${ws.id}`} className="workspace-card">
          <h3 className="workspace-card__name">{ws.name}</h3>
          <p className="workspace-card__meta">
            Created {new Date(ws.created_at).toLocaleDateString()}
          </p>
        </Link>
      ))}
    </div>
  );
}
