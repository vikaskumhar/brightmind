export type Language = 'en' | 'hi';
export interface Preferences { textSize: 'large' | 'extra-large'; highContrast: boolean; soundEnabled: boolean; reducedMotion: boolean; language: Language; difficulty: 'easy' | 'medium' | 'hard'; reminderTime?: string; }
export interface User { id: string; email: string; name: string; ageRange: string; createdAt: string; preferences: Preferences; }
export type GameKind = 'memory' | 'numbers' | 'words';
export interface GameResult { id: string; game: GameKind; score: number; total: number; durationSeconds: number; playedAt: string; }
export interface DashboardData { completedToday: number; totalGames: number; streak: number; recent: GameResult[]; }
