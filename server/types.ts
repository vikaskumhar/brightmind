export type Language = 'en' | 'hi';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type TextSize = 'large' | 'extra-large';

export interface Preferences { textSize: TextSize; highContrast: boolean; soundEnabled: boolean; reducedMotion: boolean; language: Language; difficulty: Difficulty; reminderTime?: string; }
export interface User { id: string; email: string; passwordHash: string; name: string; ageRange: string; createdAt: string; preferences: Preferences; }
export type GameKind = 'memory' | 'numbers' | 'words';
export interface GameResult { id: string; userId: string; game: GameKind; score: number; total: number; durationSeconds: number; playedAt: string; }
export interface StoredData { users: User[]; gameResults: GameResult[]; }
export type PublicUser = Omit<User, 'passwordHash'>;
