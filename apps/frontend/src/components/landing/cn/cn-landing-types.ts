export type CnLandingFeature = {
  icon: string;
  title: string;
  description: string;
};

export type CnComparisonRow = {
  label: string;
  dobby: string;
  workbuddy: string;
  codingAgents: string;
  openClaw: string;
};

export type CnFaqItem = {
  q: string;
  a: string;
};

export type CnLandingContent = {
  badge: string;
  title: string;
  subtitle: string;
  primaryCta: { label: string; href: string };
  secondaryCta: { label: string; href: string };
  featuresTitle: string;
  features: CnLandingFeature[];
  comparisonTitle: string;
  comparisonSubtitle: string;
  comparisonHeaders: {
    dimension: string;
    dobby: string;
    workbuddy: string;
    codingAgents: string;
    openClaw: string;
  };
  comparisonRows: CnComparisonRow[];
  faqTitle: string;
  faq: CnFaqItem[];
  closingTitle: string;
  closingBody: string;
  closingChecks: string[];
};
