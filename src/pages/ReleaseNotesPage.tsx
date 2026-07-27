import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { supabase } from '@/shared/lib/supabase';
import { LoadingSpinner } from '@/shared/ui/LoadingSpinner';
import { ErrorMessage } from '@/shared/ui/ErrorMessage';
import type { Release, ReleaseChange } from '@/shared/types';

export function ReleaseNotesPage() {
  const { productSlug } = useParams<{ productSlug: string }>();

  const { data: releases, isLoading, isError, error } = useQuery({
    queryKey: ['public-releases', productSlug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('releases')
        .select('*, release_changes(*)')
        .eq('status', 'published')
        .order('published_at', { ascending: false });
      if (error) throw error;
      return data as (Release & { release_changes: ReleaseChange[] })[];
    },
    enabled: !!productSlug,
  });

  if (isLoading) return <LoadingSpinner size="lg" />;
  if (isError) return <ErrorMessage message={error instanceof Error ? error.message : 'Failed to load release notes'} />;

  const grouped = releases?.reduce<Record<string, ReleaseChange[]>>((acc, release) => {
    release.release_changes.forEach((change) => {
      if (!acc[change.category]) acc[change.category] = [];
      acc[change.category]!.push(change);
    });
    return acc;
  }, {}) ?? {};

  return (
    <div className="release-notes-page">
      <h1>Release Notes: {productSlug}</h1>
      {!releases?.length ? (
        <p>No published releases yet.</p>
      ) : (
        releases.map((release) => (
          <article key={release.id} className="release-notes">
            <h2>{release.title} <small>v{release.version}</small></h2>
            <p className="release-notes__date">
              {release.published_at && new Date(release.published_at).toLocaleDateString()}
            </p>
            {release.description && <p>{release.description}</p>}
            {Object.entries(grouped).map(([category, changes]) => (
              <div key={category} className="release-notes__category">
                <h3>{category}</h3>
                <ul>
                  {changes.map((change) => (
                    <li key={change.id}>{change.title}: {change.description}</li>
                  ))}
                </ul>
              </div>
            ))}
          </article>
        ))
      )}
    </div>
  );
}
