import { permanentRedirect } from 'next/navigation';

export default function LegacyAliasPage() {
  permanentRedirect('/');
}
