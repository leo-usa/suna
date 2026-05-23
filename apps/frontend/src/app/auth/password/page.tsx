import { redirect } from 'next/navigation';

type PasswordAuthRedirectProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PasswordAuthRedirect({ searchParams }: PasswordAuthRedirectProps) {
  const params = await searchParams;
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') {
      query.set(key, value);
    } else if (Array.isArray(value)) {
      value.forEach((entry) => query.append(key, entry));
    }
  }

  const qs = query.toString();
  redirect(qs ? `/auth?${qs}` : '/auth');
}
