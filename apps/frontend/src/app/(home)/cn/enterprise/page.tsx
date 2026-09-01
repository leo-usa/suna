import { permanentRedirect } from 'next/navigation';

export default function LegacyCnEnterprisePage() {
  permanentRedirect('/cn');
}
