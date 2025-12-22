import { useState, useCallback } from 'react';
import { apiCall } from '../services/api';

interface UseApiOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
  showToast?: boolean;
}

export const useApi = (options: UseApiOptions = {}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  const execute = useCallback(
    async (
      method: 'get' | 'post' | 'put' | 'delete',
      url: string,
      requestData?: any,
      callOptions?: UseApiOptions
    ) => {
      setLoading(true);
      setError(null);

      // Merge base options with call-specific options
      const mergedOptions: UseApiOptions = { ...options, ...callOptions };

      try {
        const result = await apiCall(method, url, requestData);
        setData(result);

        if (mergedOptions.onSuccess) {
          mergedOptions.onSuccess(result);
        }

        return result;
      } catch (err: any) {
        // Normalise error to a human-readable message for state
        const errorMessage =
          (err && typeof err === 'object' && 'message' in err && err.message) ||
          (typeof err === 'string' ? err : 'An error occurred');

        setError(errorMessage);

        if (mergedOptions.onError) {
          // Keep passing the original error object to onError for compatibility
          mergedOptions.onError(err);
        }

        // ⚠️ IMPORTANT: do NOT rethrow here.
        // Callers should rely on `error` state and/or `onError`, not thrown errors.
        return undefined;
      } finally {
        setLoading(false);
      }
    },
    [options]
  );

  return {
    loading,
    error,  // always string | null now
    data,
    execute,
    setError,
    setData,
  };
};

// Specialized hooks
export const useGet = (url: string, options?: UseApiOptions) => {
  const api = useApi(options);

  const fetch = useCallback(async () => {
    return api.execute('get', url);
  }, [api, url]);

  return { ...api, fetch };
};

export const usePost = (url: string, options?: UseApiOptions) => {
  const api = useApi(options);

  const post = useCallback(
    async (data: any) => {
      return api.execute('post', url, data);
    },
    [api, url]
  );

  return { ...api, post };
};

export const usePut = (url: string, options?: UseApiOptions) => {
  const api = useApi(options);

  const put = useCallback(
    async (data: any) => {
      return api.execute('put', url, data);
    },
    [api, url]
  );

  return { ...api, put };
};

export const useDelete = (url: string, options?: UseApiOptions) => {
  const api = useApi(options);

  const del = useCallback(async () => {
    return api.execute('delete', url);
  }, [api, url]);

  return { ...api, del };
};
