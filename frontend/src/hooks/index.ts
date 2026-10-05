// Hooks Index
export { useAuth } from './useAuth';
export { useQuery, useMutation, useQueryClient, queryClient } from './useQueryProvider';
export { 
  useMediaQuery, 
  useIsMobile, 
  useIsTablet, 
  useIsDesktop, 
  useIsLargeDesktop,
  useReducedMotion,
  useHighContrast
} from './useMediaQuery';

export { useTopics, useAllTopics, useTopic, useCreateTopic, useUpdateTopic, useUpdateTopicChecklist, useSaveTopicNotes, useDeleteTopic, patchTopicCache, topicsKey, getTopicsMode, resetTopicsMode } from './useTopics';
export { useSubjects, useSubjectRegistry, useSubjectActions, validateSubjectName, useTopicsBySubject, groupTopicsBySubject, SUBJECT_MAX_LENGTH } from './useSubjects';
export { useAttendanceSubjects, useAttendanceStats, useAttendanceSubject, useCreateAttendanceSubject, useUpdateAttendanceSubject, useAddAttendanceRecord, useUndoAttendanceRecord, useUpdateAttendanceTarget, useDeleteAttendanceSubject, calculateSubjectStats, calculateClassesNeeded } from './useAttendance';
export { useResources, useCreateResource, useDeleteResource, useDeleteTopicResources, useAddDocuments, useR2UploadUrl, useR2DownloadUrl, uploadResourceToR2, uploadResourceAsBase64, fileToBase64, resourcesKey, getResourcesMode, resetResourcesMode } from './useResources';
export { useYouTubeStatus, useYouTubeSearch, useYouTubeVideo, formatDuration, formatViewCount, formatPublishedDate } from './useYouTube';
export { useSearchStatus, useWebSearch } from './useSearch';
export { useAIChat, useAIChatStream, useAIProviders, createSystemPrompt, createStudyPrompt, createQuizPrompt, createSummaryPrompt, createExplanationPrompt } from './useAI';
export { useImagesStatus, useGenerateImage, IMAGE_MODELS, IMAGE_SIZES, IMAGE_FORMATS, getDefaultImageOptions } from './useImages';
export { useSyncStatus, useSyncPull, useSyncPush, useImportBackup, buildPushPayload, performFullSync, performPushSync, createBackupV1, createFullBackupV1, downloadBackup, parseBackupFile } from './useSync';