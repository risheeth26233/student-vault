import { useQuery, useMutation } from '@tanstack/react-query';
import { youtubeApi } from '../services/api';
import type { YouTubeSearchOptions } from '../types/api';

export function useYouTubeStatus() {
  return useQuery({
    queryKey: ['youtube', 'status'],
    queryFn: () => youtubeApi.status(),
    staleTime: 1000 * 60 * 10,
  });
}

export function useYouTubeSearch() {
  return useMutation({
    mutationFn: (options: YouTubeSearchOptions) => youtubeApi.search(options),
  });
}

export function useYouTubeVideo(id: string) {
  return useQuery({
    queryKey: ['youtube', 'video', id],
    queryFn: () => youtubeApi.getVideo(id),
    enabled: !!id,
  });
}

export function formatDuration(seconds: string): string {
  // Parse ISO 8601 duration (PT#H#M#S)
  const match = seconds.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return seconds;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const secs = parseInt(match[3] || '0', 10);
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function formatViewCount(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
}

export function formatPublishedDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}