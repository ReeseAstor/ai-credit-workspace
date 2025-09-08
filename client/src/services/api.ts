import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { ApiResponse } from '../types';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.api.interceptors.request.use(
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
    this.api.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Unauthorized - clear token and redirect to login
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth endpoints
  async login(credentials: { username: string; password: string }): Promise<ApiResponse<any>> {
    const response = await this.api.post('/auth/login', credentials);
    return response.data;
  }

  async register(userData: any): Promise<ApiResponse<any>> {
    const response = await this.api.post('/auth/register', userData);
    return response.data;
  }

  async getProfile(): Promise<ApiResponse<any>> {
    const response = await this.api.get('/auth/me');
    return response.data;
  }

  async updateProfile(data: any): Promise<ApiResponse<any>> {
    const response = await this.api.put('/auth/profile', data);
    return response.data;
  }

  async changePassword(data: { currentPassword: string; newPassword: string }): Promise<ApiResponse<any>> {
    const response = await this.api.put('/auth/change-password', data);
    return response.data;
  }

  // Credit application endpoints
  async getApplications(params?: any): Promise<ApiResponse<any>> {
    const response = await this.api.get('/credit/applications', { params });
    return response.data;
  }

  async getApplication(id: string): Promise<ApiResponse<any>> {
    const response = await this.api.get(`/credit/applications/${id}`);
    return response.data;
  }

  async createApplication(data: any): Promise<ApiResponse<any>> {
    const response = await this.api.post('/credit/applications', data);
    return response.data;
  }

  async updateApplication(id: string, data: any): Promise<ApiResponse<any>> {
    const response = await this.api.put(`/credit/applications/${id}`, data);
    return response.data;
  }

  async submitApplication(id: string): Promise<ApiResponse<any>> {
    const response = await this.api.post(`/credit/applications/${id}/submit`);
    return response.data;
  }

  async uploadDocuments(id: string, formData: FormData): Promise<ApiResponse<any>> {
    const response = await this.api.post(`/credit/applications/${id}/documents`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async assignApplication(id: string, assigneeId: string): Promise<ApiResponse<any>> {
    const response = await this.api.post(`/credit/applications/${id}/assign`, { assigneeId });
    return response.data;
  }

  async addReviewNote(id: string, note: string, category?: string): Promise<ApiResponse<any>> {
    const response = await this.api.post(`/credit/applications/${id}/notes`, { note, category });
    return response.data;
  }

  async getApplicationStats(): Promise<ApiResponse<any>> {
    const response = await this.api.get('/credit/stats');
    return response.data;
  }

  // AI endpoints
  async getAIStatus(): Promise<ApiResponse<any>> {
    const response = await this.api.get('/ai/status');
    return response.data;
  }

  async analyzeApplication(data: { applicationId?: string; applicantData?: any }): Promise<ApiResponse<any>> {
    const response = await this.api.post('/ai/analyze', data);
    return response.data;
  }

  async batchAnalyze(data: { applicationIds?: string[]; filters?: any }): Promise<ApiResponse<any>> {
    const response = await this.api.post('/ai/batch-analyze', data);
    return response.data;
  }

  async getAIMetrics(): Promise<ApiResponse<any>> {
    const response = await this.api.get('/ai/metrics');
    return response.data;
  }

  async retrainModel(data?: any): Promise<ApiResponse<any>> {
    const response = await this.api.post('/ai/retrain', data);
    return response.data;
  }

  // Dashboard endpoints
  async getDashboardOverview(): Promise<ApiResponse<any>> {
    const response = await this.api.get('/dashboard/overview');
    return response.data;
  }

  async getMyWork(): Promise<ApiResponse<any>> {
    const response = await this.api.get('/dashboard/my-work');
    return response.data;
  }

  async getAnalytics(params?: any): Promise<ApiResponse<any>> {
    const response = await this.api.get('/dashboard/analytics', { params });
    return response.data;
  }

  async getTeamPerformance(): Promise<ApiResponse<any>> {
    const response = await this.api.get('/dashboard/team-performance');
    return response.data;
  }

  async getAlerts(): Promise<ApiResponse<any>> {
    const response = await this.api.get('/dashboard/alerts');
    return response.data;
  }

  // User management endpoints
  async getUsers(params?: any): Promise<ApiResponse<any>> {
    const response = await this.api.get('/users', { params });
    return response.data;
  }

  async createUser(data: any): Promise<ApiResponse<any>> {
    const response = await this.api.post('/users', data);
    return response.data;
  }

  async updateUser(id: string, data: any): Promise<ApiResponse<any>> {
    const response = await this.api.put(`/users/${id}`, data);
    return response.data;
  }

  async deleteUser(id: string): Promise<ApiResponse<any>> {
    const response = await this.api.delete(`/users/${id}`);
    return response.data;
  }

  // Generic get method for custom endpoints
  async get<T>(endpoint: string, params?: any): Promise<ApiResponse<T>> {
    const response = await this.api.get(endpoint, { params });
    return response.data;
  }

  // Generic post method for custom endpoints
  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    const response = await this.api.post(endpoint, data);
    return response.data;
  }

  // Generic put method for custom endpoints
  async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    const response = await this.api.put(endpoint, data);
    return response.data;
  }

  // Generic delete method for custom endpoints
  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    const response = await this.api.delete(endpoint);
    return response.data;
  }
}

export default new ApiService();