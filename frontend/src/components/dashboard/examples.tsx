'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import {
  BarChart3,
  Bot,
  Briefcase,
  Settings,
  Sparkles,
  RefreshCw,
  TrendingUp,
  Users,
  Shield,
  Zap,
  Target,
  Brain,
  Globe,
  Heart,
  PenTool,
  Code,
  Camera,
  Calendar,
  DollarSign,
  Rocket,
} from 'lucide-react';

type PromptExample = {
  title: string;
  query: string;
  icon: React.ReactNode;
};

const allPrompts: PromptExample[] = [
  {
    title: 'marketResearchDashboard',
    query: 'marketResearchDashboard',
    icon: <BarChart3 className="text-green-700 dark:text-green-400" size={16} />,
  },
  {
    title: 'recommendationEngine',
    query: 'recommendationEngine',
    icon: <Bot className="text-blue-700 dark:text-blue-400" size={16} />,
  },
  {
    title: 'goToMarketStrategy',
    query: 'goToMarketStrategy',
    icon: <Briefcase className="text-rose-700 dark:text-rose-400" size={16} />,
  },
  {
    title: 'dataPipelineAutomation',
    query: 'dataPipelineAutomation',
    icon: <Settings className="text-purple-700 dark:text-purple-400" size={16} />,
  },
  {
    title: 'productivitySystem',
    query: 'productivitySystem',
    icon: <Target className="text-orange-700 dark:text-orange-400" size={16} />,
  },
  {
    title: 'contentMarketingPlan',
    query: 'contentMarketingPlan',
    icon: <PenTool className="text-indigo-700 dark:text-indigo-400" size={16} />,
  },
  {
    title: 'portfolioAnalysis',
    query: 'portfolioAnalysis',
    icon: <DollarSign className="text-emerald-700 dark:text-emerald-400" size={16} />,
  },
  {
    title: 'customerJourneyMap',
    query: 'customerJourneyMap',
    icon: <Users className="text-cyan-700 dark:text-cyan-400" size={16} />,
  },
  {
    title: 'abTestingFramework',
    query: 'abTestingFramework',
    icon: <TrendingUp className="text-teal-700 dark:text-teal-400" size={16} />,
  },
  {
    title: 'codeReviewAutomation',
    query: 'codeReviewAutomation',
    icon: <Code className="text-violet-700 dark:text-violet-400" size={16} />,
  },
  {
    title: 'riskAssessmentMatrix',
    query: 'riskAssessmentMatrix',
    icon: <Shield className="text-red-700 dark:text-red-400" size={16} />,
  },
  {
    title: 'learningPathGenerator',
    query: 'learningPathGenerator',
    icon: <Brain className="text-pink-700 dark:text-pink-400" size={16} />,
  },
  {
    title: 'socialMediaAutomation',
    query: 'socialMediaAutomation',
    icon: <Globe className="text-blue-600 dark:text-blue-300" size={16} />,
  },
  {
    title: 'healthTrackingDashboard',
    query: 'healthTrackingDashboard',
    icon: <Heart className="text-red-600 dark:text-red-300" size={16} />,
  },
  {
    title: 'projectAutomation',
    query: 'projectAutomation',
    icon: <Calendar className="text-amber-700 dark:text-amber-400" size={16} />,
  },
  {
    title: 'salesFunnelOptimizer',
    query: 'salesFunnelOptimizer',
    icon: <Zap className="text-yellow-600 dark:text-yellow-300" size={16} />,
  },
  {
    title: 'startupPitchDeck',
    query: 'startupPitchDeck',
    icon: <Rocket className="text-orange-600 dark:text-orange-300" size={16} />,
  },
  {
    title: 'photographyWorkflow',
    query: 'photographyWorkflow',
    icon: <Camera className="text-slate-700 dark:text-blue-400" size={16} />,
  },
  {
    title: 'supplyChainAnalysis',
    query: 'supplyChainAnalysis',
    icon: <Briefcase className="text-stone-700 dark:text-stone-400" size={16} />,
  },
  {
    title: 'uxResearchFramework',
    query: 'uxResearchFramework',
    icon: <Sparkles className="text-fuchsia-700 dark:text-fuchsia-400" size={16} />,
  },
];

// Function to get random prompts
const getRandomPrompts = (count: number = 3): PromptExample[] => {
  const shuffled = [...allPrompts].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

export const Examples = ({
  onSelectPrompt,
}: {
  onSelectPrompt?: (query: string) => void;
}) => {
  const { t } = useTranslation();
  const [displayedPrompts, setDisplayedPrompts] = useState<PromptExample[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Initialize with random prompts on mount
  useEffect(() => {
    setDisplayedPrompts(getRandomPrompts(3));
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setDisplayedPrompts(getRandomPrompts(3));
    setTimeout(() => setIsRefreshing(false), 300);
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4">
      <div className="group relative">
        <div className="flex gap-2 justify-center py-2">
          {displayedPrompts.map((prompt, index) => (
            <motion.div
              key={`${prompt.title}-${index}`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                duration: 0.3,
                delay: index * 0.03,
                ease: "easeOut"
              }}
            >
              <Button
                variant="outline"
                className="w-fit h-fit px-3 py-2 rounded-full border-neutral-200 dark:border-neutral-800 bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-sm font-normal text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => onSelectPrompt && onSelectPrompt(t(`dashboard.examples.queries.${prompt.query}`))}
              >
                <div className="flex items-center gap-2">
                  <div className="flex-shrink-0">
                    {React.cloneElement(prompt.icon as React.ReactElement, { size: 14 })}
                  </div>
                  <span className="whitespace-nowrap">{t(`dashboard.examples.${prompt.title}`)}</span>
                </div>
              </Button>
            </motion.div>
          ))}
        </div>

        {/* Refresh button that appears on hover */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          className="absolute -top-4 right-1 h-5 w-5 p-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          <motion.div
            animate={{ rotate: isRefreshing ? 360 : 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <RefreshCw size={10} className="text-muted-foreground" />
          </motion.div>
        </Button>
      </div>
    </div>
  );
};