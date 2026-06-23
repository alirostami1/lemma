import {
  type UseMutationOptions,
  type UseQueryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  completeFileUpload,
  createFileDownloadUrl,
  createFileUpload,
  getFile,
  listFiles,
} from "./api";
import { filesKeys } from "./keys";
import type {
  CompleteFileUploadInput,
  CreateFileDownloadUrlInput,
  CreateFileUploadInput,
  File,
  FileDownloadUrl,
  FilesPage,
  FileUploadResult,
  ListFilesInput,
} from "./model";

export function useFilesQuery(
  input?: ListFilesInput,
  options?: Omit<UseQueryOptions<FilesPage>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryFn: () => listFiles(input),
    queryKey: filesKeys.list(input),
    ...options,
  });
}

export function useFileQuery(
  fileId: string,
  options?: Omit<UseQueryOptions<File>, "queryKey" | "queryFn">,
) {
  return useQuery({
    enabled: Boolean(fileId),
    queryFn: () => getFile(fileId),
    queryKey: filesKeys.detail(fileId),
    ...options,
  });
}

export function useCreateFileUpload(
  options?: UseMutationOptions<FileUploadResult, Error, CreateFileUploadInput>,
) {
  return useMutation({
    mutationFn: createFileUpload,
    ...options,
  });
}

export function useCompleteFileUpload(
  options?: UseMutationOptions<File, Error, CompleteFileUploadInput>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: completeFileUpload,
    ...options,
    onSuccess: async (file, variables, onMutateResult, context) => {
      queryClient.setQueryData(filesKeys.detail(file.id), file);
      await queryClient.invalidateQueries({ queryKey: filesKeys.lists() });
      await options?.onSuccess?.(file, variables, onMutateResult, context);
    },
  });
}

export function useCreateFileDownloadUrl(
  options?: UseMutationOptions<
    FileDownloadUrl,
    Error,
    CreateFileDownloadUrlInput
  >,
) {
  return useMutation({
    mutationFn: createFileDownloadUrl,
    ...options,
  });
}
