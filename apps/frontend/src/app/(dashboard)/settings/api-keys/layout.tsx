import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'API Keys | Dobby',
  description: 'Manage your API keys for programmatic access to Dobby',
  openGraph: {
    title: 'API Keys | Dobby',
    description: 'Manage your API keys for programmatic access to Dobby',
    type: 'website',
  },
};

export default async function APIKeysLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
