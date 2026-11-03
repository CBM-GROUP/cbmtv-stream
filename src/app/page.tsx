"use client";

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { getHomepage } from '@/services/homepage';
import { HomeSections } from '@/components/HomeSections';
import { HomeHero } from '@/components/HomeHero';

export default function HomePage() {
  const { user, loading } = useAuth();
  const homepage = useQuery({
    queryKey: ['homepage', user?.id ?? 'anonymous'],
    queryFn: ({ signal }) => getHomepage(user?.id, signal),
    enabled: !loading, staleTime: 0, gcTime: 0, refetchInterval: 60000,
  });
  if (loading || homepage.isPending) return <HomeHero titles={[]} loading />;
  if (homepage.isError) return <><HomeHero titles={[]} /><div className="content-section py-8" role="alert">Couldn&apos;t load the homepage. <button className="min-h-11 text-teal-300 underline" onClick={() => void homepage.refetch()}>Try again</button></div></>;
  return <HomeSections homepage={homepage.data} authenticated={Boolean(user)} />;
}
