import { useQuery, useMutation } from '@tanstack/react-query';
import { searchApi } from '../services/api';
import type { SearchOptions } from '../types/api';

export function useSearchStatus() {
  return useQuery({
    queryKey: ['search', 'status'],
    queryFn: () => searchApi.status(),
    staleTime: 1000 * 60 * 10,
  });
}

export function useWebSearch() {
  return useMutation({
    mutationFn: (options: SearchOptions) => searchApi.search(options),
  });
}