import { useQuery } from '@tanstack/react-query';
import { backendApi } from '@/lib/api-client';
import { accountStateKeys } from './use-account-state';

export interface ModelPricingItem {
  id: string;
  name: string;
  priority: number;
  requires_subscription: boolean;
  input_cost_per_million_tokens: number;
  output_cost_per_million_tokens: number;
  cached_read_cost_per_million_tokens: number;
}

export interface ModelPricingResponse {
  success: boolean;
  models: ModelPricingItem[];
  markup_multiplier: number;
  credits_per_dollar: number;
  timestamp: string;
}

async function fetchModelPricing(): Promise<ModelPricingResponse> {
  const response = await backendApi.get<ModelPricingResponse>(
    '/billing/model-pricing',
    { showErrors: false }
  );
  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'Failed to fetch model pricing');
  }
  return response.data;
}

export function useModelPricing(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...accountStateKeys.all, 'model-pricing'],
    queryFn: fetchModelPricing,
    enabled: options?.enabled ?? true,
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 60 * 24,
    retry: 2,
  });
}
