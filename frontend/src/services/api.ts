import axios from 'axios';

// Create axios instance with base URL
const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.msg || error.message || 'Something went wrong';
    
    // Auto logout on 401 Unauthorized
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    
    return Promise.reject({ 
      message, 
      status: error.response?.status,
      data: error.response?.data 
    });
  }
);

// Helper function for API calls with loading state
export const apiCall = async (
  method: 'get' | 'post' | 'put' | 'delete',
  url: string,
  data?: any,
  options?: any
) => {
  try {
    const response = await api({
      method,
      url,
      data,
      ...options
    });
    return response.data;
  } catch (error: any) {
    console.error(`API Error (${method.toUpperCase()} ${url}):`, error);
    throw error;
  }
};

// Export commonly used methods
export const get = (url: string, params?: any) => api.get(url, { params });
export const post = (url: string, data?: any) => api.post(url, data);
export const put = (url: string, data?: any) => api.put(url, data);
export const del = (url: string) => api.delete(url);

export default api;