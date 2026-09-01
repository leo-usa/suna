import { permanentRedirect } from 'next/navigation';

export default function LegacyCnConsumerPage() {
  permanentRedirect('/cn');
}
