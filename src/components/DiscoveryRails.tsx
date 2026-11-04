'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { getRanking, getRecommended } from '@/services/discovery';
import { ContentRail } from './ContentRail';

export function DiscoveryRails() {
  const { user, loading: authLoading } = useAuth();
  const trending = useQuery({ queryKey: ['discovery', 'trending'], queryFn: ({ signal }) => getRanking('trending', signal), staleTime: 60000, retry: 1 });
  const watched = useQuery({ queryKey: ['discovery', 'most-watched'], queryFn: ({ signal }) => getRanking('most-watched', signal), staleTime: 60000, retry: 1 });
  const personal = useQuery({ queryKey: ['discovery', 'recommended', user?.id],
    queryFn: ({ signal }) => getRecommended(user!.id, signal), enabled: !authLoading && Boolean(user), staleTime: 60000, retry: 1 });
  return <div className="pt-5">
    <ContentRail title="Trending Now" items={trending.data?.items} loading={trending.isPending} error={trending.isError} onRetry={() => { void trending.refetch(); }} source="trending" />
    <ContentRail title="Most Watched" items={watched.data?.items} loading={watched.isPending} error={watched.isError} onRetry={() => { void watched.refetch(); }} source="most_watched" />
    {user && <ContentRail title={personal.data?.personalized ? 'Recommended for You' : 'Explore for You'}
      items={personal.data?.items} loading={personal.isPending} error={personal.isError} onRetry={() => { void personal.refetch(); }}
      source={personal.data?.personalized ? 'personalized' : 'most_watched'} />}
  </div>;
}
