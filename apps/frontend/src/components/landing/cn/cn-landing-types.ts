export type CnLandingFeature = {
  icon: string;
  title: string;
  description: string;
};

export type CnComparisonRow = {
  label: string;
  dobby: string;
  openClaw: string;
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
  comparisonRows: CnComparisonRow[];
  closingTitle: string;
  closingBody: string;
};

export type CnLandingVariant = 'consumer' | 'enterprise';
