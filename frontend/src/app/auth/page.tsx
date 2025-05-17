import { redirect } from 'next/navigation';

export default function AuthRedirectPage() {
  redirect('/en/auth'); // Change 'en' to your default locale if needed
  return null;
} 