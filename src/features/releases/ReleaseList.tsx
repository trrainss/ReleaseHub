import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, Link } from 'react-router-dom';
import { useState } from 'react';
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
}

export function ReleaseList({ productId }: ReleaseListProps) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') ?? '';
  const search = searchParams.get('search') ?? '';
  const page = Number(searchParams.get('page') ?? '1');

  const [searchInput, setSearchInput] = useState(search);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    version: '',
    title: '',
    description: '',
  });

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: releaseKeys.list(productId, { status, search, page: String(page) }),
    queryFn: () => getReleases(productId, { status: status || undefined, search: search || undefined, page }),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => createRelease({
      ...data,
      product_id: productId,
      created_by: user!.id,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: releaseKeys.list(productId, { status, search, page: String(page) }) 
      });
      setShowCreateModal(false);
      setFormData({ version: '', title: '', description: '' });
    },
    onError: (error: any) => {
      addToast(error instanceof Error ? error.message : 'Failed to create release', 'error');
      console.error('Create error:', error);
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

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  if (isLoading) return <LoadingSpinner size="lg" />;
  if (isError) return <ErrorMessage message={error instanceof Error ? error.message : 'Failed to load releases'} onRetry={refetch} />;

  return (
    <div>
      {/* Кнопка создания релиза - вверху страницы */}
      <div className="release-list__toolbar">
        <div className="release-list__filters">
          <div className="release-list__search">
            <Input
              placeholder="Search by title or version..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button size="sm" onClick={handleSearch}>Search</Button>
          </div>
          <Select
            value={status}
            onChange={(e) => updateFilter('status', e.target.value)}
            options={STATUS_OPTIONS}
          />
        </div>
        <Button onClick={() => setShowCreateModal(true)}>+ New Release</Button>
      </div>

      {!data?.data.length ? (
        <EmptyState 
          title="No releases found" 
          description="Create a release to get started."
          action={
            <Button onClick={() => setShowCreateModal(true)}>Create Release</Button>
          }
        />
      ) : (
        <>
          <div className="release-list__grid">
            {data.data.map((release) => {
              const changesCount = (release as Record<string, unknown>).release_changes as { count: number } | undefined;
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
                  {changesCount?.count ?? 0} changes
                  {release.published_at && ` · Published ${new Date(release.published_at).toLocaleDateString()}`}
                </p>
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

      {/* Модалка создания релиза */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create Release">
        <form onSubmit={handleCreate} className="modal-form">
          <Input
            label="Version"
            value={formData.version}
            onChange={(e) => setFormData({ ...formData, version: e.target.value })}
            placeholder="1.0.0"
            required
          />
          <Input
            label="Title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="Release title"
            required
          />
          <Input
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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