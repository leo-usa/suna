import { getDictionary } from '../getDictionary';
import { CTASection } from "@/components/home/sections/cta-section";
// import { FAQSection } from "@/components/sections/faq-section";
import { FooterSection } from "@/components/home/sections/footer-section";
import { HeroSection } from "@/components/home/sections/hero-section";
// import { OpenSourceSection } from "@/components/home/sections/open-source-section";
import { PricingSection } from "@/components/home/sections/pricing-section";
import { UseCasesSection } from "@/components/home/sections/use-cases-section";

export default async function Home({ params }: { params: { locale: string } }) {
  const paramsAwaited = await params;
  const dict = await getDictionary(paramsAwaited.locale);
  return (
    <main className="flex flex-col items-center justify-center min-h-screen w-full">
      <div className="w-full divide-y divide-border">
        <HeroSection dict={dict} />
        <UseCasesSection dict={dict} />
        {/* <CompanyShowcase /> */}
        {/* <BentoSection /> */}
        {/* <QuoteSection /> */}
        {/* <FeatureSection /> */}
        {/* <GrowthSection /> */}
        {/* <OpenSourceSection dict={dict} /> */}
        <PricingSection dict={dict} />
        {/* <TestimonialSection /> */}
        {/* <FAQSection /> */}
        <CTASection dict={dict} />
        <FooterSection dict={dict} />
      </div>
    </main>
  );
} 