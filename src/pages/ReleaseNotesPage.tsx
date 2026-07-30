import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { getPublishedReleases } from '@/shared/api/releases';
import { LoadingSpinner } from '@/shared/ui/LoadingSpinner';
import { ErrorMessage } from '@/shared/ui/ErrorMessage';
import type { ReleaseChange } from '@/shared/types';

function groupChangesByCategory(changes: ReleaseChange[]): Record<string, ReleaseChange[]> {
  return changes.reduce<Record<string, ReleaseChange[]>>((acc, change) => {
    if (!acc[change.category]) acc[change.category] = [];
    acc[change.category]!.push(change);
    return acc;
  }, {});
}

export function ReleaseNotesPage() {
  const { productSlug } = useParams<{ productSlug: string }>();

  const { data: releases, isLoading, isError, error } = useQuery({
    queryKey: ['public-releases', productSlug],
    queryFn: () => getPublishedReleases(productSlug!),
    enabled: !!productSlug,
  });

  if (isLoading) return <LoadingSpinner size="lg" />;
  if (isError) return <ErrorMessage message={error instanceof Error ? error.message : 'Failed to load release notes'} />;

  return (
    <div className="release-notes-page">
      <h1>Release Notes: {productSlug}</h1>
      {!releases?.length ? (
        <p>No published releases yet.</p>
      ) : (
        releases.map((release) => {
          const changes = Array.isArray(release.release_changes) ? release.release_changes : [];
          const grouped = groupChangesByCategory(changes);
          return (
            <article key={release.id} className="release-notes">
              <h2>{release.title} <small>v{release.version}</small></h2>
              <p className="release-notes__date">
                {release.published_at && new Date(release.published_at).toLocaleDateString()}
              </p>
              {release.description && <p>{release.description}</p>}
              {Object.entries(grouped).map(([category, categoryChanges]) => (
                <div key={category} className="release-notes__category">
                  <h3>{category}</h3>
                  <ul>
                    {categoryChanges.map((change) => (
                      <li key={change.id}>{change.title}: {change.description}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </article>
          );
        })
      )}
    </div>
  );
}
