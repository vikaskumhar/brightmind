import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { GameResult, Preferences, StoredData, User } from './types';

const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const useSupabase = Boolean(supabaseUrl && supabaseKey);

const dataPath = join(process.cwd(), 'data', 'bright-mind.json');
const defaultPreferences: Preferences = { textSize: 'large', highContrast: false, soundEnabled: true, reducedMotion: false, language: 'en', difficulty: 'easy' };

function load(): StoredData { const data = existsSync(dataPath) ? JSON.parse(readFileSync(dataPath, 'utf8')) : { users: [], gameResults: [] }; return { users: data.users ?? [], gameResults: data.gameResults ?? [] }; }
function save(data: StoredData) { mkdirSync(dirname(dataPath), { recursive: true }); writeFileSync(dataPath, JSON.stringify(data, null, 2)); }
async function db<T>(table: string, query = '', method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}${query}`, { method, body: body === undefined ? undefined : JSON.stringify(body), headers: { apikey: supabaseKey!, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation' } });
  const text = await response.text();
  if (!response.ok) throw new Error(`Database request failed (${response.status}): ${text || response.statusText}`);
  return (text ? JSON.parse(text) : []) as T;
}
const preferences = (row: any): Preferences => ({ textSize: row.text_size, highContrast: row.high_contrast, soundEnabled: row.sound_enabled, reducedMotion: row.reduced_motion, language: row.preferred_language ?? 'en', difficulty: row.difficulty_preference ?? 'easy', reminderTime: row.reminder_time ?? undefined });
async function userFromRow(row: any): Promise<User> {
  const [profile] = await db<any[]>('profiles', `?user_id=eq.${row.id}&select=*`);
  const [prefs] = await db<any[]>('user_preferences', `?user_id=eq.${row.id}&select=*`);
  return { id: row.id, email: row.email, passwordHash: row.password_hash, name: profile?.display_name ?? '', ageRange: profile?.age_range ?? '', createdAt: row.created_at, preferences: prefs ? preferences(prefs) : { textSize: 'large', highContrast: false, soundEnabled: true, reducedMotion: false, language: 'en', difficulty: 'easy' } };
}

export const store = {
  async findByEmail(email: string) { if (useSupabase) { const [row] = await db<any[]>('users', `?email=eq.${encodeURIComponent(email.toLowerCase())}&select=*`); return row ? userFromRow(row) : undefined; } return load().users.find((user) => user.email === email.toLowerCase()); },
  async findById(id: string) { if (useSupabase) { const [row] = await db<any[]>('users', `?id=eq.${encodeURIComponent(id)}&select=*`); return row ? userFromRow(row) : undefined; } return load().users.find((user) => user.id === id); },
  async create(input: Omit<User, 'id' | 'createdAt' | 'preferences'>) {
    if (useSupabase) {
      const [row] = await db<any[]>('users', '?select=*', 'POST', { email: input.email.toLowerCase(), password_hash: input.passwordHash });
      await db('profiles', '', 'POST', { user_id: row.id, display_name: input.name, age_range: input.ageRange });
      await db('user_preferences', '', 'POST', { user_id: row.id, text_size: 'large', high_contrast: false, sound_enabled: true, reduced_motion: false, preferred_language: 'en', difficulty_preference: 'easy' });
      return userFromRow(row);
    }
    const data = load(); const user: User = { ...input, email: input.email.toLowerCase(), id: randomUUID(), createdAt: new Date().toISOString(), preferences: defaultPreferences };
    data.users.push(user); save(data); return user;
  },
  async updatePreferences(id: string, values: Partial<Preferences>) {
    if (useSupabase) {
      const columns: Record<string, string> = { textSize: 'text_size', highContrast: 'high_contrast', soundEnabled: 'sound_enabled', reducedMotion: 'reduced_motion', language: 'preferred_language', difficulty: 'difficulty_preference', reminderTime: 'reminder_time' };
      const body = Object.fromEntries(Object.entries(values).map(([key, value]) => [columns[key], value]));
      await db('user_preferences', `?user_id=eq.${encodeURIComponent(id)}`, 'PATCH', body);
      return this.findById(id);
    }
    const data = load(); const user = data.users.find((item) => item.id === id); if (!user) return undefined;
    user.preferences = { ...user.preferences, ...values }; save(data); return user;
  },
  async addGameResult(input: Omit<GameResult, 'id' | 'playedAt'>) { if (useSupabase) { const [row] = await db<any[]>('game_sessions', '?select=id', 'POST', { user_id: input.userId, game_id: input.game, difficulty: 'easy', completed_at: new Date().toISOString() }); const [result] = await db<any[]>('game_results', '?select=*', 'POST', { session_id: row.id, score: input.score, accuracy: input.total ? input.score / input.total * 100 : 0, time_taken_seconds: input.durationSeconds }); return { ...input, id: result.id, playedAt: result.created_at }; } const data = load(); const result: GameResult = { ...input, id: randomUUID(), playedAt: new Date().toISOString() }; data.gameResults.unshift(result); save(data); return result; },
  async resultsForUser(userId: string) { if (useSupabase) { const sessions = await db<any[]>('game_sessions', `?user_id=eq.${encodeURIComponent(userId)}&completed_at=not.is.null&select=id,game_id,completed_at,game_results(id,score,accuracy,time_taken_seconds,created_at)&order=completed_at.desc`); return sessions.map((s) => ({ id: s.game_results?.id ?? s.id, userId, game: s.game_id as GameResult['game'], score: s.game_results?.score ?? 0, total: 100, durationSeconds: s.game_results?.time_taken_seconds ?? 0, playedAt: s.game_results?.created_at ?? s.completed_at })); } return load().gameResults.filter((result) => result.userId === userId); }
};
