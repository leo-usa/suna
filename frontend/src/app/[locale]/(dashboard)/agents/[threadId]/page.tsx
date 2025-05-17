import { getDictionary } from '@/app/[locale]/getDictionary';
import { ThreadPage } from './thread-page.client';

export default async function Page({ params }: { params: { locale: string, threadId: string } }) {
  const dict = await getDictionary(params.locale);
  return <ThreadPage dict={dict} />;
} 