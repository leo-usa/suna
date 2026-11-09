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
  updated_at?: string;
  html_url: string;
  html_path: string;
  artifact_type: WorkArtifactType;
  language: 'zh' | 'en' | string;
  slug?: string | null;
  thread_id?: string | null;
  project_id?: string | null;
  branded?: boolean;
  status?: string;
  vanity_url?: string;
  custom_domain?: string;
  custom_domain_verified?: boolean;
  custom_domain_url?: string;
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
  vanity_url?: string;
  artifact_type: WorkArtifactType;
  language: string;
  html_url: string;
  branded?: boolean;
  updated?: boolean;
  slug?: string;
  skipped_secrets?: string[];
}

export interface MySitesResponse {
  posts: WorkPost[];
  total: number;
  active_count: number;
  sites_limit: number;
  branded: boolean;
  custom_domain: boolean;
  tier_name: string;
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

export async function fetchPublicWork(postId: string): Promise<WorkPost | null> {
  const api = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000/v1';
  const response = await fetch(`${api}/community/post/${encodeURIComponent(postId)}`, {
    next: { revalidate: 300 },
  });
  if (!response.ok) return null;
  return response.json();
}

export function workOgImagePath(postId: string): string {
  return `/api/works/og-image/${encodeURIComponent(postId)}`;
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
  slug?: string;
  postId?: string;
  replaceExisting?: boolean;
}): Promise<PublishWorkResponse> {
  const response = await backendApi.post<PublishWorkResponse>(
    '/publish',
    {
      project_id: input.projectId,
      thread_id: input.threadId,
      title: input.title,
      description: input.description,
      slug: input.slug,
      post_id: input.postId,
      replace_existing: Boolean(input.replaceExisting),
    },
    { timeout: 120000, showErrors: false },
  );
  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'Failed to publish');
  }
  return response.data;
}

export async function listMySites(includeUnpublished = false): Promise<MySitesResponse> {
  const search = new URLSearchParams({
    include_unpublished: includeUnpublished ? 'true' : 'false',
  });
  const response = await backendApi.get<MySitesResponse>(`/publish/mine?${search.toString()}`, {
    showErrors: false,
  });
  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'Failed to load your sites');
  }
  return response.data;
}

export async function unpublishSite(postId: string): Promise<void> {
  const response = await backendApi.post(`/publish/${encodeURIComponent(postId)}/unpublish`, {});
  if (!response.success) {
    throw new Error(response.error?.message || 'Failed to unpublish');
  }
}

export async function setSiteCustomDomain(postId: string, domain: string) {
  const response = await backendApi.post<{
    success: boolean;
    domain: string;
    verified: boolean;
    instructions: { cname: string; txt_name: string; txt_value: string };
  }>(`/publish/${encodeURIComponent(postId)}/domain`, { domain });
  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'Failed to set domain');
  }
  return response.data;
}

export async function verifySiteCustomDomain(postId: string) {
  const response = await backendApi.post<{
    success: boolean;
    verified: boolean;
    domain: string;
    errors?: string[];
  }>(`/publish/${encodeURIComponent(postId)}/domain/verify`, {});
  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'Failed to verify domain');
  }
  return response.data;
}
