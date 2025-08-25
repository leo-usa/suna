import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AnimatedShinyText } from '@/components/ui/animated-shiny-text';
import { useTranslation } from 'react-i18next';

const items = [
    { id: 1, key: 'initializing-neural' },
    { id: 2, key: 'analyzing-query' },
    { id: 3, key: 'assembling-cognitive' },
    { id: 4, key: 'orchestrating-thoughts' },
    { id: 5, key: 'synthesizing-context' },
    { id: 6, key: 'calibrating-parameters' },
    { id: 7, key: 'engaging-reasoning' },
    { id: 8, key: 'processing-semantic' },
    { id: 9, key: 'formulating-strategy' },
    { id: 10, key: 'optimizing-pathways' },
    { id: 11, key: 'harmonizing-streams' },
    { id: 12, key: 'architecting-response' },
    { id: 13, key: 'fine-tuning-models' },
    { id: 14, key: 'weaving-narratives' },
    { id: 15, key: 'crystallizing-insights' },
    { id: 16, key: 'preparing-analysis' }
  ];

export const AgentLoader = () => {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  
  useEffect(() => {
    const id = setInterval(() => {
      setIndex((state) => {
        if (state >= items.length - 1) return 0;
        return state + 1;
      });
    }, 1500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex py-2 items-center w-full">
      <div>✨</div>
            <AnimatePresence>
            <motion.div
                key={items[index].id}
                initial={{ y: 20, opacity: 0, filter: "blur(8px)" }}
                animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                exit={{ y: -20, opacity: 0, filter: "blur(8px)" }}
                transition={{ ease: "easeInOut" }}
                style={{ position: "absolute" }}
                className='ml-7'
            >
                <AnimatedShinyText>{t(`agentLoader.${items[index].key}`)}</AnimatedShinyText>
            </motion.div>
            </AnimatePresence>
        </div>
  );
};
