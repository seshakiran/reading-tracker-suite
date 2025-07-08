import axios from 'axios';
import { ReadingSession, ReadingStats, Tag, NewSession } from '../types';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Reading Sessions
export const getSessions = async (): Promise<ReadingSession[]> => {
  const response = await api.get('/api/sessions');
  return response.data;
};

export const createSession = async (session: NewSession): Promise<any> => {
  const response = await api.post('/api/sessions', session);
  return response.data;
};

// Statistics
export const getStats = async (): Promise<ReadingStats> => {
  const response = await api.get('/api/stats');
  return response.data;
};

// Tags
export const getTags = async (): Promise<Tag[]> => {
  const response = await api.get('/api/tags');
  return response.data;
};

// Health check
export const healthCheck = async (): Promise<any> => {
  const response = await api.get('/health');
  return response.data;
};

export default api;