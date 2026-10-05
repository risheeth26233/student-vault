import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { syncApi } from '../services/api';
import {
  addDocument,
  createResource,
  deleteResource,
  deleteTopicResources,
  fileToBase64,
  listResources,
  resourcesKey,
  uploadResourceToR2,
} from '../services/resourceStore';
import type { Resource } from '../types/api';

export { fileToBase64, uploadResourceToR2 };
export { resourcesKey, getResourcesMode, resetResourcesMode } from '../services/resourceStore';

export function useResources(topicId?: string) {
  return useQuery({
    queryKey: [...resourcesKey, topicId],
    // No topicId = fetch all resources (used by the dashboard overview)
    queryFn: () => listResources({ topicId }),
    staleTime: 1000 * 60 * 2,
  });
}

export function useCreateResource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createResource,
    onSuccess: (_, { topicId }) => {
      queryClient.invalidateQueries({ queryKey: [...resourcesKey, topicId] });
    },
  });
}

export function useDeleteResource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteResource(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: resourcesKey });
    },
  });
}

export function useDeleteTopicResources() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (topicId: string) => deleteTopicResources(topicId),
    onSuccess: (_, topicId) => {
      queryClient.invalidateQueries({ queryKey: [...resourcesKey, topicId] });
    },
  });
}

/** Upload one or more files into a topic (cloud → base64 → IndexedDB). */
export function useAddDocuments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ files, topicId }: { files: File[]; topicId: string }) => {
      const created: Resource[] = [];
      for (const file of files) {
        created.push(await addDocument(file, topicId));
      }
      return created;
    },
    onSuccess: (_, { topicId }) => {
      queryClient.invalidateQueries({ queryKey: resourcesKey });
      queryClient.invalidateQueries({ queryKey: [...resourcesKey, topicId] });
    },
  });
}

export function useR2UploadUrl() {
  return useMutation({
    mutationFn: ({ resourceId, fileName, contentType }: { resourceId: string; fileName: string; contentType: string }) =>
      syncApi.getUploadUrl(resourceId, fileName, contentType),
  });
}

export function useR2DownloadUrl() {
  return useMutation({
    mutationFn: (key: string) => syncApi.getDownloadUrl(key),
  });
}

export async function uploadResourceAsBase64(
  file: File,
  topicId: string
): Promise<Resource> {
  const base64 = await fileToBase64(file);
  return createResource({
    topicId,
    name: file.name,
    mimeType: file.type,
    size: file.size,
    data: base64,
  });
}
