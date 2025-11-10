import { useQuery } from '@tanstack/react-query';
import { listChannels } from '@/services/channels';

export function useChannels() {
  return useQuery({
    queryKey: ['channels'],
    queryFn: listChannels,
  });
}
