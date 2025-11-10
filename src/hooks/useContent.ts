import { useQuery } from '@tanstack/react-query';
import { listContent } from '@/services/content';
import { Program } from '@/types';

export function useContent() {
  return useQuery<Program[]>({ 
    queryKey: ['content'],
    queryFn: listContent,
  });
}