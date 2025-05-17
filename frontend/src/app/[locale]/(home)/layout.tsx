import { Navbar } from "@/components/home/sections/navbar";
import { getDictionary } from "../getDictionary";

export default async function HomeLayout({
  children,
  params
}: Readonly<{
  children: React.ReactNode;
  params: { locale: string }
}>) {
  const paramsAwaited = await params;
  const dict = await getDictionary(paramsAwaited.locale);
  return (
    <div className="w-full relative">
      <div className="block w-px h-full border-l border-border fixed top-0 left-6 z-10"></div>
      <div className="block w-px h-full border-r border-border fixed top-0 right-6 z-10"></div>
      <Navbar dict={dict} locale={paramsAwaited.locale} />
      {children}
    </div>
  );
} 