-- Run in the Supabase SQL editor. The API uses a server-only service role key.
DO $$ BEGIN CREATE TYPE user_role AS ENUM ('member', 'caregiver', 'admin'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE game_difficulty AS ENUM ('easy', 'medium', 'hard'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'member', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, display_name TEXT NOT NULL,
  age_range TEXT, photo_url TEXT, preferred_language TEXT NOT NULL DEFAULT 'en', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, text_size TEXT NOT NULL DEFAULT 'large', high_contrast BOOLEAN NOT NULL DEFAULT FALSE,
  sound_enabled BOOLEAN NOT NULL DEFAULT TRUE, reduced_motion BOOLEAN NOT NULL DEFAULT FALSE, difficulty_preference game_difficulty NOT NULL DEFAULT 'easy', reminder_time TIME, reminder_frequency TEXT
);
CREATE TABLE IF NOT EXISTS games (id TEXT PRIMARY KEY, title TEXT NOT NULL, category TEXT NOT NULL, enabled BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
INSERT INTO games (id,title,category) VALUES ('memory','Memory Match','memory'),('numbers','Number Sequence','patterns'),('words','Word Builder','words') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS game_sessions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, game_id TEXT NOT NULL REFERENCES games(id), difficulty game_difficulty NOT NULL, started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), completed_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS game_results (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), session_id UUID NOT NULL UNIQUE REFERENCES game_sessions(id) ON DELETE CASCADE, score INTEGER NOT NULL, accuracy NUMERIC(5,2), time_taken_seconds INTEGER, mistakes INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS daily_goals (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, goal_date DATE NOT NULL, game_id TEXT NOT NULL REFERENCES games(id), completed BOOLEAN NOT NULL DEFAULT FALSE, UNIQUE(user_id, goal_date, game_id));
CREATE TABLE IF NOT EXISTS streaks (user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, current_days INTEGER NOT NULL DEFAULT 0, best_days INTEGER NOT NULL DEFAULT 0, last_active_date DATE);
CREATE TABLE IF NOT EXISTS caregiver_relationships (caregiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, member_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(caregiver_id, member_id));
CREATE INDEX IF NOT EXISTS game_sessions_user_completed_idx ON game_sessions(user_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS game_results_created_idx ON game_results(created_at DESC);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE caregiver_relationships ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated grants: requests go through the trusted API using service_role.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
