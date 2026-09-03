import { useQuery } from '@tanstack/react-query';
import { billingApi } from '@/lib/api/billing';
import {
  FALLBACK_CREDIT_PACKAGES,
  type CreditPackage,
  type CreditPackagesResponse,
} from '@/lib/credit-packages';
import { accountStateKeys } from './use-account-state';

export function useCreditPackages() {
  const query = useQuery({
    queryKey: [...accountStateKeys.all, 'credit-packages'],
    queryFn: async (): Promise<CreditPackagesResponse> => {
      try {
        return await billingApi.getCreditPackages();
      } catch {
        return {
          packages: FALLBACK_CREDIT_PACKAGES,
          credits_per_dollar: 1000,
        };
      }
    },
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 24,
    retry: 1,
  });

  const packages: CreditPackage[] =
    query.data?.packages?.length ? query.data.packages : FALLBACK_CREDIT_PACKAGES;

  return {
    ...query,
    packages,
  };
}

export type { CreditPackage, CreditPackagesResponse };
