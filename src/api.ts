import type { DashboardData, GameKind, Preferences, User } from './types';
const request = async <T>(path: string, init: RequestInit = {}) => {
  const token = localStorage.getItem('bright-mind-token');
  const response = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers } });
  const text = await response.text();
  let body: { message?: string } & Record<string, unknown>;
  try { body = text ? JSON.parse(text) : {}; } catch { throw new Error(`The server returned an invalid response (${response.status}). Check the API terminal for details.`); }
  if (!response.ok) throw new Error(body.message || `Request failed (${response.status}).`); return body as T;
};
export const api = {
  login: (email: string, password: string) => request<{ token: string; user: User }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (input: { name: string; email: string; password: string; ageRange: string }) => request<{ token: string; user: User }>('/api/auth/register', { method: 'POST', body: JSON.stringify(input) }),
  me: () => request<{ user: User }>('/api/me'),
  preferences: (input: Partial<Preferences>) => request<{ user: User }>('/api/preferences', { method: 'PATCH', body: JSON.stringify(input) }),
  dashboard: () => request<DashboardData>('/api/dashboard'),
  saveGame: (input: { game: GameKind; score: number; total: number; durationSeconds: number }) => request('/api/game-results', { method: 'POST', body: JSON.stringify(input) })
};
