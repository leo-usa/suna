import { redirect } from 'next/navigation';

export default async function CommunityViewRedirect({
  params,
}: {
  params: Promise<{ postId: string }> | { postId: string };
}) {
  const resolved = await Promise.resolve(params);
  redirect(`/works/${resolved.postId}`);
}
