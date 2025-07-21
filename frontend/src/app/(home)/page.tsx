'use client';

import { useEffect, useState } from 'react';
import { CTASection } from '@/components/home/sections/cta-section';
// import { FAQSection } from "@/components/sections/faq-section";
import { FooterSection } from '@/components/home/sections/footer-section';
import { HeroSection } from '@/components/home/sections/hero-section';
import HomeBillingTabs from '@/components/home/sections/home-billing-tabs';
import { UseCasesSection } from '@/components/home/sections/use-cases-section';
import { ModalProviders } from '@/providers/modal-providers';
import CommunityGallerySection from '@/components/home/sections/community-gallery-section';

export default function Home() {
  return (
    <>
      <ModalProviders />
      <main className="flex flex-col items-center justify-center min-h-screen w-full">
        <div className="w-full divide-y divide-border">
          <HeroSection />
          <UseCasesSection />
          {/* <CompanyShowcase /> */}
          {/* <BentoSection /> */}
          {/* <QuoteSection /> */}
          {/* <FeatureSection /> */}
          {/* <GrowthSection /> */}
          <CommunityGallerySection />
          <div className='flex flex-col items-center px-4'>
            <HomeBillingTabs />
          </div>
          {/* <TestimonialSection /> */}
          {/* <FAQSection /> */}
          <CTASection />
          <FooterSection />
        </div>
      </main>
    </>
  );
}
