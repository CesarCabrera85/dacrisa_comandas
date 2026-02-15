/**
 * useFeatureFlags - React hook for feature flag management
 */

import { useEffect, useState, useCallback } from 'react';

interface UseFeatureFlagsReturn {
  flags: Record<string, boolean>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  isEnabled: (key: string) => boolean;
}

export function useFeatureFlags(): UseFeatureFlagsReturn {
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFlags = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/feature-flags', {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch feature flags');
      }
      
      const data = await response.json();
      setFlags(data);
    } catch (err) {
      console.error('Error fetching feature flags:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  const isEnabled = useCallback((key: string): boolean => {
    return flags[key] === true;
  }, [flags]);

  return { flags, loading, error, refetch: fetchFlags, isEnabled };
}

export default useFeatureFlags;
