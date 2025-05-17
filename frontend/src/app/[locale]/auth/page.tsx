import { Suspense } from "react";
import { getDictionary } from "../getDictionary";
import LoginContent from "./login-content";

export default async function LoginPage({ params }: { params: { locale: string } }) {
  const paramsAwaited = await params;
  const dict = await getDictionary(paramsAwaited.locale);
  return (
    <Suspense fallback={
      <main className="flex flex-col items-center justify-center min-h-screen w-full">
        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
      </main>
    }>
      <LoginContent dict={dict} locale={paramsAwaited.locale} />
    </Suspense>
  );
}
