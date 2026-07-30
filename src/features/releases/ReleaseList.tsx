import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, Link } from 'react-router-dom';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getReleases, createRelease } from '@/shared/api/releases';
import { useAuth } from '@/shared/hooks/useAuth';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Select } from '@/shared/ui/Select';
import { LoadingSpinner } from '@/shared/ui/LoadingSpinner';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorMessage } from '@/shared/ui/ErrorMessage';
import { Modal } from '@/shared/ui/Modal';
import { useToast } from '@/shared/ui/Toast';
import { releaseKeys } from '@/shared/lib/queryKeys';
import { canCreateRelease } from '@/shared/lib/roles';
import type { Role } from '@/shared/types';

const createReleaseSchema = z.object({
  version: z.string().min(1, 'Version is required'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
});

type CreateReleaseFormData = z.infer<typeof createReleaseSchema>;

const SORT_OPTIONS = [
  { value: 'created_at', label: 'Date (newest)' },
  { value: 'version', label: 'Version' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'review', label: 'In Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'published', label: 'Published' },
];

interface ReleaseListProps {
  productId: string;
  userRole?: Role;
}

export function ReleaseList({ productId, userRole }: ReleaseListProps) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') ?? '';
  const search = searchParams.get('search') ?? '';
  const sort = searchParams.get('sort') ?? 'created_at';
  const page = Number(searchParams.get('page') ?? '1');

  const [searchInput, setSearchInput] = useState(search);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateReleaseFormData>({
    resolver: zodResolver(createReleaseSchema),
  });

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: releaseKeys.list(productId, { status, search, sort, page: String(page) }),
    queryFn: () => getReleases(productId, { status: status || undefined, search: search || undefined, sort: sort || undefined, page }),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateReleaseFormData) => createRelease({
      version: data.version,
      title: data.title,
      description: data.description ?? null,
      product_id: productId,
      created_by: user!.id,
      planned_at: null,
      published_at: null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: releaseKeys.list(productId, { status, search, page: String(page) }) 
      });
      setShowCreateModal(false);
      reset();
      addToast('Release created', 'success');
    },
    onError: (error: Error) => {
      addToast(error instanceof Error ? error.message : 'Failed to create release', 'error');
    },
  });

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete('page');
    setSearchParams(params);
  };

  const handleSearch = () => {
    updateFilter('search', searchInput);
  };

  const handleCreate = handleSubmit((data) => {
    createMutation.mutate(data);
  });

  const canCreate = userRole ? canCreateRelease(userRole) : false;

  if (isLoading) return <LoadingSpinner size="lg" />;
  if (isError) return <ErrorMessage message={error instanceof Error ? error.message : 'Failed to load releases'} onRetry={refetch} />;

  return (
    <div>
      <div className="release-list__toolbar">
        <div className="release-list__filters">
          <div className="release-list__search">
            <Input
              placeholder="Search by title or version..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch}>Search</Button>
          </div>
          <Select
            value={status}
            onChange={(e) => updateFilter('status', e.target.value)}
            options={STATUS_OPTIONS}
          />
          <Select
            value={sort}
            onChange={(e) => updateFilter('sort', e.target.value)}
            options={SORT_OPTIONS}
          />
        </div>
        {canCreate && (
          <Button onClick={() => setShowCreateModal(true)}>+ New Release</Button>
        )}
      </div>

      {!data?.data.length ? (
        <EmptyState 
          title="No releases found" 
          description="Create a release to get started."
          action={
            canCreate ? (
              <Button onClick={() => setShowCreateModal(true)}>Create Release</Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="release-list__grid">
            {data.data.map((release) => {
              return (
              <Link key={release.id} to={`/releases/${release.id}`} className="release-card">
                <div className="release-card__header">
                  <h3>{release.title}</h3>
                  <span className={`status-badge status-badge--${release.status}`}>
                    {release.status}
                  </span>
                </div>
                <p className="release-card__version">{release.version}</p>
                <p className="release-card__meta">
                  {(!Array.isArray(release.release_changes) && release.release_changes?.count) ?? 0} changes
                  {release.release_reviewers && release.release_reviewers.count > 0 && ` · ${release.release_reviewers.count} reviewers`}
                  {release.published_at && ` · Published ${new Date(release.published_at).toLocaleDateString()}`}
                </p>
                {release.status === 'review' && release.release_reviewers && (
                  <div className="release-card__progress">
                    <span className="release-card__progress-label">
                      Review: {release.release_reviewers.count} reviewer(s)
                    </span>
                  </div>
                )}
              </Link>
              );
            })}
          </div>
          {data.count > 20 && (
            <div className="pagination">
              <Button
                variant="ghost"
                disabled={page <= 1}
                onClick={() => updateFilter('page', String(page - 1))}
              >
                Previous
              </Button>
              <span>Page {page}</span>
              <Button
                variant="ghost"
                disabled={page * 20 >= data.count}
                onClick={() => updateFilter('page', String(page + 1))}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create Release">
        <form onSubmit={handleCreate} className="modal-form">
          <Input
            label="Version"
            {...register('version')}
            error={errors.version?.message}
            placeholder="1.0.0"
          />
          <Input
            label="Title"
            {...register('title')}
            error={errors.title?.message}
            placeholder="Release title"
          />
          <Input
            label="Description"
            {...register('description')}
            error={errors.description?.message}
            placeholder="Release description"
          />
          <div className="modal__actions">
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create Release'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}