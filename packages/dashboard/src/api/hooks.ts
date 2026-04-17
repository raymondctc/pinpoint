import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchFeedbackList,
  fetchFeedbackItem,
  updateFeedbackStatus,
  deleteFeedback,
  fetchProjects,
  createProject,
  type FeedbackListParams,
} from './client.js';

export function usePinpointList(params: FeedbackListParams = {}) {
  return useQuery({
    queryKey: ['feedback', 'list', params],
    queryFn: () => fetchFeedbackList(params),
  });
}

export function usePinpointItem(id: string) {
  return useQuery({
    queryKey: ['feedback', 'detail', id],
    queryFn: () => fetchFeedbackItem(id),
    enabled: !!id,
  });
}

export function useUpdateFeedbackStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updateFeedbackStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
    },
  });
}

export function useDeleteFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteFeedback(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
    },
  });
}

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ name, slug }: { name: string; slug: string }) =>
      createProject(name, slug),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}