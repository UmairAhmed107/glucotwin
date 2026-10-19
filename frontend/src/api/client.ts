import { ApiErrorDetail } from './types';

// Default to backend at localhost:8000 or proxy
export const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export class ApiError extends Error {
  code: string;
  details?: Record<string, any>;
  statusCode: number;

  constructor(message: string, code: string = 'ERROR', statusCode: number = 500, details?: Record<string, any>) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

// Global toast listeners
type ToastListener = (toast: { type: 'success' | 'error' | 'info'; title: string; message: string }) => void;
const toastListeners = new Set<ToastListener>();

export function subscribeToToasts(listener: ToastListener) {
  toastListeners.add(listener);
  return () => {
    toastListeners.delete(listener);
  };
}

export function showToast(toast: { type: 'success' | 'error' | 'info'; title: string; message: string }) {
  toastListeners.forEach((fn) => fn(toast));
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers || {}),
  };

  try {
    const res = await fetch(url, { ...options, headers });

    if (!res.ok) {
      let errorData: any = null;
      try {
        errorData = await res.json();
      } catch {
        // Not JSON
      }

      const code = errorData?.error?.code || `HTTP_${res.status}`;
      const message = errorData?.error?.message || errorData?.detail || res.statusText || 'Request failed';
      const details = errorData?.error?.details || errorData?.details;

      const apiErr = new ApiError(message, code, res.status, details);
      showToast({
        type: 'error',
        title: `Error: ${code}`,
        message: typeof message === 'string' ? message : JSON.stringify(message),
      });
      throw apiErr;
    }

    // 204 No Content
    if (res.status === 204) {
      return {} as T;
    }

    return (await res.json()) as T;
  } catch (err: any) {
    if (err instanceof ApiError) {
      throw err;
    }
    const message = err?.message || 'Network error connecting to backend';
    showToast({
      type: 'error',
      title: 'Connection Error',
      message: `${message}. Is the backend running at ${BASE_URL}?`,
    });
    throw new ApiError(message, 'NETWORK_ERROR', 0);
  }
}
