import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ModelStore {
  selectedModel: string;
  lastAutoModelId: string;
  setSelectedModel: (model: string) => void;
  setLastAutoModelId: (modelId: string) => void;
}

export const useModelStore = create<ModelStore>()(
  persist(
    (set) => ({
      selectedModel: '', // Will be set by the hook based on API data
      lastAutoModelId: '',
      setSelectedModel: (model: string) => {
        console.log('🔧 ModelStore: Setting selected model to:', model);
        set({ selectedModel: model });
      },
      setLastAutoModelId: (modelId: string) => {
        set({ lastAutoModelId: modelId });
      },
    }),
    {
      name: 'suna-model-selection-v3',
      partialize: (state) => ({
        selectedModel: state.selectedModel,
        lastAutoModelId: state.lastAutoModelId,
      }),
    }
  )
);

// Utility functions for compatibility
export const formatModelName = (name: string): string => {
  return name
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};
