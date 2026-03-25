import axios from 'axios';
import { userAuth, adminAuth } from './auth';

/**
 * User API instance — used in /dashboard/* pages
 * Automatically attaches user token (kyc_user_token) from localStorage.
 */
export const userApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor — attach user JWT token
userApi.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = userAuth.getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — handle 401 for user API
userApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      userAuth.clear();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

/**
 * Admin API instance — used in /admin/* pages
 * Automatically attaches admin token (kyc_admin_token) from localStorage.
 */
export const adminApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor — attach admin JWT token
adminApi.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = adminAuth.getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — handle 401 for admin API
adminApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      adminAuth.clear();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Default export kept for backward compatibility — maps to userApi
export default userApi;
