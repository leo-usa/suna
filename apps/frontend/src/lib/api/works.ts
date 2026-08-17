import { backendApi } from '@/lib/api-client';

export type WorkArtifactType =
  | 'site'
  | 'slides'
  | 'images'
  | 'video'
  | 'sheet'
  | 'docs'
  | 'mixed';

export interface WorkFile {
  path: string;
  url: string;
}

export interface WorkPost {
  id: string;
  title: string;
  user_name: string;
  like_count: number;
  description: string;
  thumbnail_path: string;
  created_at: string;
  html_url: string;
  html_path: string;
  artifact_type: WorkArtifactType;
  language: 'zh' | 'en' | string;
  slug?: string | null;
  thread_id?: string | null;
  files: WorkFile[];
}

export interface WorksListResponse {
  posts: WorkPost[];
  total: number;
}

export interface PublishWorkResponse {
  success: boolean;
  id: string;
  post_id: string;
  url: string;
  artifact_type: WorkArtifactType;
  language: string;
  html_url: string;
}

export function worksLangFromLocale(locale: string | undefined): 'zh' | 'en' {
  return locale?.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export function workPath(post: Pick<WorkPost, 'id' | 'slug'>): string {
  return `/works/${post.slug || post.id}`;
}

export function publicHtmlUrl(postId: string): string {
  const api = process.env.NEXT_PUBLIC_BACKEND_URL || '';
  return `${api}/public-html/${postId}`;
}

export async function listWorks(params: {
  lang: 'zh' | 'en';
  limit?: number;
  offset?: number;
  sortBy?: 'created_at' | 'like_count';
}): Promise<WorksListResponse> {
  const search = new URLSearchParams({
    lang: params.lang,
    limit: String(params.limit ?? 20),
    offset: String(params.offset ?? 0),
    sort_by: params.sortBy ?? 'created_at',
    order: 'desc',
  });
  const response = await backendApi.get<WorksListResponse>(`/community?${search.toString()}`, {
    showErrors: false,
  });
  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'Failed to load works');
  }
  return response.data;
}

export async function getWork(postId: string): Promise<WorkPost> {
  const response = await backendApi.get<WorkPost>(`/community/post/${encodeURIComponent(postId)}`, {
    showErrors: false,
  });
  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'Work not found');
  }
  return response.data;
}

export async function likeWork(postId: string): Promise<number> {
  const response = await backendApi.post<{ like_count: number }>('/community/like', {
    post_id: postId,
  });
  if (!response.success) {
    throw new Error(response.error?.message || 'Failed to like work');
  }
  return response.data?.like_count ?? 0;
}

export async function publishWork(input: {
  projectId: string;
  threadId?: string;
  title?: string;
  description?: string;
}): Promise<PublishWorkResponse> {
  const response = await backendApi.post<PublishWorkResponse>(
    '/publish',
    {
      project_id: input.projectId,
      thread_id: input.threadId,
      title: input.title,
      description: input.description,
    },
    { timeout: 120000, showErrors: false },
  );
  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'Failed to publish');
  }
  return response.data;
}
