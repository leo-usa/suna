import { redirect } from 'next/navigation';

export default async function CommunityViewRedirect({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;
  redirect(`/works/${postId}`);
}
