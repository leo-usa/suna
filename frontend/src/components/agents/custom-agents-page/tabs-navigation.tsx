'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, ShoppingBag, FileText } from 'lucide-react';
import { FancyTabs, TabConfig } from '@/components/ui/fancy-tabs';

interface TabsNavigationProps {
  activeTab: string;
  onTabChange: (value: string) => void;
}

export const TabsNavigation = ({ activeTab, onTabChange }: TabsNavigationProps) => {
  const { t } = useTranslation();
  
  const agentTabs: TabConfig[] = [
    {
      value: 'marketplace',
      icon: ShoppingBag,
      label: t('marketplace.explore', 'Explore'),
      shortLabel: t('marketplace.explore', 'Explore'),
    },
    {
      value: 'my-agents',
      icon: Bot,
      label: t('marketplace.myAgents', 'My Agents'),
    },
  ];

  return (
    <FancyTabs
      tabs={agentTabs}
      activeTab={activeTab}
      onTabChange={onTabChange}
    />
  );
}; 