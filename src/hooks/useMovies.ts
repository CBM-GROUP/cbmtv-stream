import { useQuery } from '@tanstack/react-query';
import { listMovies } from '@/services/movies';

export function useMovies() {
  return useQuery({
    queryKey: ['movies'],
    queryFn: listMovies,
  });
}
