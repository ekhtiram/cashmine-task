import { QueryClient, useQuery } from '@tanstack/react-query';

import { ApiError, getBalances } from './api';
import { useTokenScope } from './token';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        const status = error instanceof ApiError ? error.status : 0;
        if (status >= 400 && status < 500 && status !== 429) return false;
        return failureCount < 2;
      },
      retryDelay: (attempt, error) =>
        error instanceof ApiError && error.retryAfterMs
          ? error.retryAfterMs
          : Math.min(1000 * 2 ** attempt, 8000),
    },
  },
});

export function useBalances(refetchInterval: number | false = false) {
  const scope = useTokenScope();
  return useQuery({ queryKey: ['balances', scope], queryFn: getBalances, refetchInterval });
}
