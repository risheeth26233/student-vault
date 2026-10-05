import { useQuery, useMutation } from '@tanstack/react-query';
import { imagesApi } from '../services/api';
import type { ImageGenerationOptions } from '../types/api';

export function useImagesStatus() {
  return useQuery({
    queryKey: ['images', 'status'],
    queryFn: () => imagesApi.status(),
    staleTime: 1000 * 60 * 10,
  });
}

export function useGenerateImage() {
  return useMutation({
    mutationFn: (options: ImageGenerationOptions) => imagesApi.generate(options),
  });
}

export const IMAGE_MODELS = [
  { id: 'fal-ai/flux/dev', name: 'Flux Dev', provider: 'Fal.ai', quality: 'high' },
  { id: 'fal-ai/flux/schnell', name: 'Flux Schnell', provider: 'Fal.ai', quality: 'fast' },
  { id: 'fal-ai/stable-diffusion-v3-medium', name: 'SD3 Medium', provider: 'Fal.ai', quality: 'high' },
  { id: 'dall-e-3', name: 'DALL-E 3', provider: 'OpenAI', quality: 'high' },
  { id: 'dall-e-2', name: 'DALL-E 2', provider: 'OpenAI', quality: 'standard' },
] as const;

export const IMAGE_SIZES = [
  { width: 512, height: 512, label: '512×512 (Square)' },
  { width: 768, height: 512, label: '768×512 (Landscape)' },
  { width: 512, height: 768, label: '512×768 (Portrait)' },
  { width: 1024, height: 1024, label: '1024×1024 (Square HD)' },
  { width: 1024, height: 576, label: '1024×576 (16:9)' },
  { width: 576, height: 1024, label: '576×1024 (9:16)' },
] as const;

export const IMAGE_FORMATS = [
  { value: 'png', label: 'PNG' },
  { value: 'jpeg', label: 'JPEG' },
  { value: 'webp', label: 'WebP' },
] as const;

export function getDefaultImageOptions(): ImageGenerationOptions {
  return {
    prompt: '',
    width: 512,
    height: 512,
    format: 'png',
  };
}