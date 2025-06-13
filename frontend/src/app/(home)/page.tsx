"use client";
import I18nProvider from '@/components/I18nProvider';
import { useEffect, useState } from "react";
import { CTASection } from "@/components/home/sections/cta-section";
// import { FAQSection } from "@/components/sections/faq-section";
import { FooterSection } from "@/components/home/sections/footer-section";
import { HeroSection } from "@/components/home/sections/hero-section";
// import { OpenSourceSection } from "@/components/home/sections/open-source-section";
// import { PricingSection } from "@/components/home/sections/pricing-section";
import HomeBillingTabs from "@/components/home/sections/home-billing-tabs";
import { UseCasesSection } from "@/components/home/sections/use-cases-section";
import CommunitySection from "@/components/home/sections/community-section";

export default function Home() {
  return (
    <I18nProvider>
      <main className="flex flex-col items-center justify-center min-h-screen w-full">
        <div className="w-full divide-y divide-border">
          <HeroSection />
          <UseCasesSection />
          <CommunitySection />
          {/* <CompanyShowcase /> */}
          {/* <BentoSection /> */}
          {/* <QuoteSection /> */}
          {/* <FeatureSection /> */}
          {/* <GrowthSection /> */}
          {/* <OpenSourceSection /> */}
          <HomeBillingTabs />
          {/* <TestimonialSection /> */}
          {/* <FAQSection /> */}
          <CTASection />
          <FooterSection />
        </div>
      </main>
    </I18nProvider>
  );
} 