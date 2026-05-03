import { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Worker Conversation | Dobby',
  description: 'Interactive Worker conversation powered by Dobby',
  openGraph: {
    title: 'Worker Conversation | Dobby',
    description: 'Interactive Worker conversation powered by Dobby',
    type: 'website',
  },
};

export default async function AgentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
