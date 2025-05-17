import { getDictionary } from '@/app/[locale]/getDictionary';
import { ThreadPage } from './thread-page.client';

export default async function Page({ params }: { params: Promise<{ locale: string, threadId: string }> }) {
  const awaitedParams = await params;
  const dict = await getDictionary(awaitedParams.locale);
  return <ThreadPage params={Promise.resolve(awaitedParams)} dict={dict} />;
} 