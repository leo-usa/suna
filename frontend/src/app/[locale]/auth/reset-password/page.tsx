import { Suspense } from "react";
import { getDictionary } from "../../getDictionary";
import ResetPasswordContent from "../reset-password-content";

export default async function ResetPasswordPage({ params }: { params: { locale: string } }) {
  const dict = await getDictionary(params.locale);
  return (
    <Suspense fallback={
      <main className="flex flex-col items-center justify-center min-h-screen w-full">
        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
      </main>
    }>
      <ResetPasswordContent dict={dict} locale={params.locale} />
    </Suspense>
  );
} 