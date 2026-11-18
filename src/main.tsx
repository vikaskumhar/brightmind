import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import {
  auth,
  ensureUserProfile,
  recordCognitiveSession,
  signInWithGoogle,
  signOutFirebase,
  subscribeUserProfile,
  subscribeUserSessions,
  updateUserPreferences,
  type AllGameId,
  type CognitiveSessionRecord,
  type FirebaseUserProfile
} from './firebase';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import {
  AdvancedCognitiveGamesModule,
  type SessionMetrics
} from './modules/AdvancedCognitiveGamesModule';
import { t } from './i18n';
import './styles.css';

type ClassicGameKind = 'memory' | 'numbers' | 'words';
type FinishClassic = (game: ClassicGameKind, score: number, durationSeconds: number) => void;

const GAME_LABELS: Record<AllGameId, { title: string; domain: string; summary: string }> = {
  memory: { title: 'Memory Match', domain: 'Memory', summary: 'Find matching cards' },
  numbers: { title: 'Number Sequence', domain: 'Patterns', summary: 'Choose what comes next' },
  words: { title: 'Word Builder', domain: 'Verbal', summary: 'Unscramble familiar words' },
  'mental-rotation': { title: 'Mental Rotation Grid', domain: 'Visuospatial Manipulation', summary: 'Match rotated shapes' },
  'trail-making-ab': { title: 'Trail Making Test A & B', domain: 'Visual Attention & Task-Switching', summary: 'Alternate 1–A–2–B' },
  'corsi-span': { title: 'Corsi Block-Tapping Span', domain: 'Visuospatial Working Memory', summary: 'Forward & reverse span' },
  'calcudoku-4x4': { title: 'Calcudoku 4×4', domain: 'Numerical Logic & Constraint Satisfaction', summary: 'Arithmetic Latin square' },
  'rvip-vigilance': { title: 'Rapid Visual Processing (RVIP)', domain: 'Sustained Vigilance', summary: 'Spot 3 odd/even digits' },
  'anagrams-fluency': { title: 'Anagrams & Word Unscrambler', domain: 'Verbal Fluency & Lexical Retrieval', summary: '60s word unscrambler' }
};

function Auth({ onCancel, onGuestLab }: { onCancel: () => void; onGuestLab: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleGoogleLogin() {
    setBusy(true);
    setError('');
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in could not be completed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">BRIGHT MIND</p>
        <h1>A calm place to keep your mind active.</h1>
        <p className="lead">
          Sign in with your Google account to save your cognitive exercise history, streaks, and accessibility preferences in Firebase.
        </p>

        {error && <p className="error">{error}</p>}

        <div className="auth-actions">
          <button
            type="button"
            className="primary"
            disabled={busy}
            onClick={handleGoogleLogin}
          >
            {busy ? 'Signing in…' : 'Continue with Google'}
          </button>
          <button type="button" className="secondary-outline" onClick={onGuestLab}>
            Try 6 Advanced Exercises without signing in
          </button>
          <button type="button" className="text-button" onClick={onCancel}>
            ← Back to overview
          </button>
        </div>
      </section>
    </main>
  );
}

function Frame({ title, back, children }: { title: string; back: () => void; children: React.ReactNode }) {
  return (
    <main className="game-page">
      <button type="button" className="quiet back" onClick={back}>
        ← Back to activities
      </button>
      <section className="game-card">
        <p className="eyebrow">TODAY'S ACTIVITY</p>
        <h1>{title}</h1>
        {children}
      </section>
    </main>
  );
}

function Memory({ back, finish }: { back: () => void; finish: FinishClassic }) {
  const [cards] = useState(() =>
    ['🌷', '🌷', '🚲', '🚲', '🍎', '🍎', '🐦', '🐦', '☕', '☕', '⭐', '⭐'].sort(() => Math.random() - 0.5)
  );
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [lock, setLock] = useState(false);
  const [startedAt] = useState(() => Date.now());

  function pick(i: number) {
    if (lock || open.includes(i) || matched.includes(i)) return;
    const n = [...open, i];
    setOpen(n);
    if (n.length === 2) {
      setLock(true);
      setMoves((m) => m + 1);
      const same = cards[n[0]] === cards[n[1]];
      window.setTimeout(() => {
        if (same) {
          const next = [...matched, ...n];
          setMatched(next);
          if (next.length === 12) {
            const elapsed = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
            finish('memory', Math.max(40, 100 - moves * 5), elapsed);
          }
        }
        setOpen([]);
        setLock(false);
      }, 650);
    }
  }

  return (
    <Frame title="Memory Match" back={back}>
      <p className="game-instruction">Turn over two cards at a time.</p>
      <p className="game-status">
        Pairs found: {matched.length / 2} of 6 · Moves: {moves}
      </p>
      <div className="memory-grid">
        {cards.map((c, i) => (
          <button
            type="button"
            className={'memory-card ' + (open.includes(i) || matched.includes(i) ? 'open' : '')}
            onClick={() => pick(i)}
            key={i}
          >
            {open.includes(i) || matched.includes(i) ? c : '?'}
          </button>
        ))}
      </div>
    </Frame>
  );
}

const NUMBER_QUESTIONS = [
  [[2, 4, 6], 8, [7, 8, 10]],
  [[5, 10, 15], 20, [18, 20, 25]],
  [[12, 10, 8], 6, [6, 7, 9]],
  [[3, 6, 12], 24, [18, 21, 24]],
  [[1, 1, 2, 3], 5, [4, 5, 6]]
] as const;

function Numbers({ back, finish }: { back: () => void; finish: FinishClassic }) {
  const [n, setN] = useState(0);
  const [score, setScore] = useState(0);
  const [chosen, setChosen] = useState<number>();
  const [startedAt] = useState(() => Date.now());
  const [list, answer, choices] = NUMBER_QUESTIONS[n];

  function choose(x: number) {
    if (chosen !== undefined) return;
    const ok = x === answer;
    setChosen(x);
    if (ok) setScore((s) => s + 1);
    window.setTimeout(() => {
      if (n === 4) {
        const elapsed = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
        finish('numbers', Math.round((score + Number(ok)) * 20), elapsed);
      } else {
        setN(n + 1);
        setChosen(undefined);
      }
    }, 650);
  }

  return (
    <Frame title="Number Sequence" back={back}>
      <p className="game-instruction">What number comes next?</p>
      <p className="game-status">Question {n + 1} of 5</p>
      <div className="sequence">
        {list.map((x) => (
          <span key={x}>{x}</span>
        ))}
        <strong>?</strong>
      </div>
      <div className="choice-row">
        {choices.map((x) => (
          <button
            type="button"
            key={x}
            className={'choice ' + (chosen === x ? (x === answer ? 'right' : 'wrong') : '')}
            onClick={() => choose(x)}
          >
            {x}
          </button>
        ))}
      </div>
    </Frame>
  );
}

const CLASSIC_WORDS = [
  ['ETARW', 'WATER'],
  ['DRAEGN', 'GARDEN'],
  ['NUSIHNSE', 'SUNSHINE'],
  ['RIFEND', 'FRIEND'],
  ['PAPHE', 'HAPPY']
] as const;

function Words({ back, finish }: { back: () => void; finish: FinishClassic }) {
  const [n, setN] = useState(0);
  const [score, setScore] = useState(0);
  const [value, setValue] = useState('');
  const [msg, setMsg] = useState('');
  const [startedAt] = useState(() => Date.now());
  const [scramble, answer] = CLASSIC_WORDS[n];

  function submit(e: FormEvent) {
    e.preventDefault();
    const ok = value.trim().toUpperCase() === answer;
    setMsg(ok ? 'Well done!' : 'The word is ' + answer + '.');
    if (ok) setScore((s) => s + 1);
    window.setTimeout(() => {
      if (n === 4) {
        const elapsed = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
        finish('words', Math.round((score + Number(ok)) * 20), elapsed);
      } else {
        setN(n + 1);
        setValue('');
        setMsg('');
      }
    }, 850);
  }

  return (
    <Frame title="Word Builder" back={back}>
      <p className="game-instruction">Put these letters in the right order.</p>
      <p className="game-status">Word {n + 1} of 5</p>
      <div className="scramble">{scramble}</div>
      <form className="word-form" onSubmit={submit}>
        <label>
          Your answer
          <input autoFocus value={value} disabled={!!msg} onChange={(e) => setValue(e.target.value)} />
        </label>
        <button type="submit" className="primary" disabled={!value || !!msg}>
          Check answer
        </button>
      </form>
      {msg && <p className="result-message">{msg}</p>}
    </Frame>
  );
}

function Landing({ start, openLab }: { start: () => void; openLab: () => void }) {
  const [menu, setMenu] = useState(false);

  return (
    <main className="landing">
      <header className="landing-nav">
        <button
          type="button"
          className="brand brand-button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          ✦ Bright Mind
        </button>
        <button
          type="button"
          className="menu-button"
          onClick={() => setMenu(!menu)}
          aria-expanded={menu}
        >
          Menu
        </button>
        <nav className={menu ? 'open' : ''} aria-label="Main navigation">
          <a href="#activities">Activities</a>
          <a href="#progress">Progress</a>
          <a href="#accessibility">Accessibility</a>
          <PWAInstallButton />
          <button type="button" className="nav-start" onClick={start}>
            Sign in
          </button>
        </nav>
      </header>

      <section className="landing-hero">
        <div className="hero-copy">
          <p className="eyebrow">A DAILY PRACTICE FOR YOUR MIND</p>
          <h1>
            Keep your mind <em>active.</em>
          </h1>
          <p className="landing-lead">
            Nine accessible cognitive exercises—from gentle daily warm-ups to scientifically grounded visuospatial, working-memory, vigilance, and fluency tasks.
          </p>
          <div className="hero-actions">
            <button type="button" className="primary" onClick={start}>
              Sign in with Google <span>→</span>
            </button>
            <button type="button" className="secondary-outline" onClick={openLab}>
              Explore 6 Cognitive Exercises
            </button>
          </div>
          <p className="reassurance">
            No pressure. No medical claims. Saved securely in Firebase Firestore when signed in.
          </p>
        </div>

        <div className="mind-orbit" aria-label="Memory, attention, pattern and problem-solving activities">
          <div className="orbit-core">
            ✦
            <small>
              Bright
              <br />
              Mind
            </small>
          </div>
          <span className="float-card card-memory">
            🧠<small>Memory</small>
          </span>
          <span className="float-card card-focus">
            ◎<small>Attention</small>
          </span>
          <span className="float-card card-pattern">
            ◇<small>Patterns</small>
          </span>
          <span className="float-card card-logic">
            ✳<small>Logic</small>
          </span>
        </div>
      </section>

      <section id="activities" className="story-section">
        <p className="eyebrow">TRAIN A LITTLE. EVERY DAY.</p>
        <h2>Small moments can make a meaningful routine.</h2>
        <div className="category-grid">
          {[
            ['🧠', 'Working Memory', 'Corsi Forward & Reverse block span plus visual matching.'],
            ['◎', 'Sustained Attention', 'Trail Making A & B task-switching and 600ms RVIP vigilance.'],
            ['◇', 'Spatial & Logic', '2D/3D Mental Rotation grids and procedural 4×4 Calcudoku.'],
            ['✳', 'Verbal Fluency', 'Timed 6–7 letter Anagrams with streak bonuses and word recall.']
          ].map(([icon, title, copy]) => (
            <article className="category-card" key={title}>
              <span>{icon}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="progress" className="progress-story">
        <div>
          <p className="eyebrow">SEE YOUR PROGRESS</p>
          <h2>Encouragement you can actually use.</h2>
          <p>
            Track accuracy percentages, reaction times in milliseconds, and daily streaks synced in real time across devices.
          </p>
          <button type="button" className="text-button" onClick={start}>
            View your progress →
          </button>
        </div>
        <div className="preview-card">
          <div className="preview-top">
            <span>This week</span>
            <strong>6 domains</strong>
          </div>
          <div className="mini-chart">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
          <div className="preview-stat">
            <span>Practice streak</span>
            <strong>🔥 7 days</strong>
          </div>
        </div>
      </section>

      <section id="accessibility" className="accessibility-story">
        <p className="eyebrow">SIMPLE ENOUGH FOR EVERYONE</p>
        <h2>Designed for comfort and confidence.</h2>
        <div className="accessibility-list">
          <span>Large, easy-to-read text</span>
          <span>High-contrast display options</span>
          <span>Touch, mouse & keyboard support</span>
          <span>Comfortable pace, always</span>
        </div>
      </section>

      <section className="final-cta">
        <p className="eyebrow">YOUR NEXT MOMENT OF PRACTICE</p>
        <h2>Start your first activity.</h2>
        <button type="button" className="primary light" onClick={start}>
          Sign in with Google <span>→</span>
        </button>
      </section>

      <footer>
        © {new Date().getFullYear()} Bright Mind · Practice for enjoyment, never diagnosis.
      </footer>
    </main>
  );
}

function Dashboard({
  firebaseUser,
  profile,
  sessions
}: {
  firebaseUser: FirebaseUser;
  profile: FirebaseUserProfile;
  sessions: CognitiveSessionRecord[];
}) {
  const [activeClassic, setActiveClassic] = useState<ClassicGameKind | null>(null);
  const [showLab, setShowLab] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [notice, setNotice] = useState('');

  const lang = profile.language ?? 'en';

  const saveSession = useCallback(
    async (metrics: {
      gameId: AllGameId;
      domain: string;
      score: number;
      accuracyPercent: number;
      avgReactionTimeMs: number;
      durationSeconds: number;
    }) => {
      try {
        await recordCognitiveSession(firebaseUser.uid, profile, metrics);
        const label = GAME_LABELS[metrics.gameId]?.title ?? metrics.gameId;
        setNotice(
          `${label} saved to Firebase — Score: ${metrics.score} · Accuracy: ${metrics.accuracyPercent}%`
        );
      } catch (err) {
        setNotice(
          err instanceof Error
            ? `Could not save session: ${err.message}`
            : 'Session ended, but could not be saved.'
        );
      }
    },
    [firebaseUser.uid, profile]
  );

  const finishClassic: FinishClassic = (game, score, durationSeconds) => {
    setActiveClassic(null);
    void saveSession({
      gameId: game,
      domain: GAME_LABELS[game].domain,
      score,
      accuracyPercent: Math.min(100, Math.max(0, score)),
      avgReactionTimeMs: 0,
      durationSeconds
    });
  };

  const handleAdvancedComplete = useCallback(
    (metrics: SessionMetrics) => {
      void saveSession(metrics);
    },
    [saveSession]
  );

  const togglePref = async (
    patch: Partial<
      Pick<
        FirebaseUserProfile,
        'textSize' | 'highContrast' | 'soundEnabled' | 'reducedMotion' | 'language'
      >
    >
  ) => {
    try {
      await updateUserPreferences(firebaseUser.uid, patch);
    } catch {
      setNotice('Could not update accessibility settings.');
    }
  };

  if (activeClassic === 'memory') {
    return <Memory back={() => setActiveClassic(null)} finish={finishClassic} />;
  }
  if (activeClassic === 'numbers') {
    return <Numbers back={() => setActiveClassic(null)} finish={finishClassic} />;
  }
  if (activeClassic === 'words') {
    return <Words back={() => setActiveClassic(null)} finish={finishClassic} />;
  }

  const todayPrefix = new Date().toISOString().slice(0, 10);
  const completedToday = new Set(
    sessions
      .filter((s) => {
        const d = s.playedAt?.toDate?.();
        return d ? d.toISOString().slice(0, 10) === todayPrefix : false;
      })
      .map((s) => s.gameId)
  ).size;

  const avgAccuracy = sessions.length
    ? Math.round(
        sessions.reduce((acc, s) => acc + (s.accuracyPercent ?? 0), 0) / sessions.length
      )
    : 0;

  const shellClasses = [
    'app-shell',
    profile.textSize === 'extra-large' ? 'text-xl-mode' : '',
    profile.highContrast ? 'high-contrast-mode' : '',
    profile.reducedMotion ? 'reduced-motion-mode' : ''
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <main className={shellClasses}>
      <header>
        <div className="brand">✦ Bright Mind</div>
        <div className="header-actions">
          <PWAInstallButton />
          <button
            type="button"
            className="quiet"
            onClick={() => setShowSettings((s) => !s)}
            aria-expanded={showSettings}
          >
            {t(lang, 'settings')}
          </button>
          <button
            type="button"
            className="quiet"
            onClick={() => void signOutFirebase()}
          >
            {t(lang, 'signOut')}
          </button>
        </div>
      </header>

      {showSettings && (
        <aside className="settings" aria-label="Accessibility settings">
          <div className="settings-head">
            <h2>{t(lang, 'settings')}</h2>
            <button type="button" className="quiet" onClick={() => setShowSettings(false)}>
              Close
            </button>
          </div>
          <label className="toggle">
            <span>Extra-large text</span>
            <input
              type="checkbox"
              checked={profile.textSize === 'extra-large'}
              onChange={(e) =>
                void togglePref({ textSize: e.target.checked ? 'extra-large' : 'large' })
              }
            />
          </label>
          <label className="toggle">
            <span>High contrast</span>
            <input
              type="checkbox"
              checked={profile.highContrast}
              onChange={(e) => void togglePref({ highContrast: e.target.checked })}
            />
          </label>
          <label className="toggle">
            <span>Sound cues</span>
            <input
              type="checkbox"
              checked={profile.soundEnabled}
              onChange={(e) => void togglePref({ soundEnabled: e.target.checked })}
            />
          </label>
          <label className="toggle">
            <span>Reduced motion</span>
            <input
              type="checkbox"
              checked={profile.reducedMotion}
              onChange={(e) => void togglePref({ reducedMotion: e.target.checked })}
            />
          </label>
          <label className="toggle">
            <span>Language</span>
            <select
              value={lang}
              onChange={(e) => void togglePref({ language: e.target.value as 'en' | 'hi' })}
            >
              <option value="en">English</option>
              <option value="hi">हिन्दी (Hindi)</option>
            </select>
          </label>
        </aside>
      )}

      <section className="dashboard">
        <p className="eyebrow">READY FOR TODAY</p>
        <h1>
          {t(lang, 'welcome')}, {profile.displayName} 👋
        </h1>

        {notice && <p className="notice">{notice}</p>}

        {showLab ? (
          <div className="lab-container">
            <AdvancedCognitiveGamesModule
              onSessionComplete={handleAdvancedComplete}
              soundEnabled={profile.soundEnabled}
              highContrast={profile.highContrast}
              onExitModule={() => setShowLab(false)}
            />
          </div>
        ) : (
          <>
            <div className="hero">
              <div>
                <h2>6 Advanced Cognitive Exercises Ready</h2>
                <p>
                  Practice Mental Rotation, Trail Making A &amp; B, Corsi Span, Calcudoku 4×4, RVIP Vigilance, and Anagrams—all saved in real time to your Firebase profile.
                </p>
                <div className="hero-btn-group">
                  <button type="button" className="primary" onClick={() => setShowLab(true)}>
                    Open 6-Game Cognitive Suite
                  </button>
                  <button
                    type="button"
                    className="secondary-outline"
                    onClick={() => setActiveClassic('memory')}
                  >
                    Quick Memory Match
                  </button>
                </div>
              </div>
              <div className="sun">☀</div>
            </div>

            <div className="stats">
              <article>
                <span>✓</span>
                <strong className="acgm-num">{completedToday}</strong>
                <small>{t(lang, 'activities')} today</small>
              </article>
              <article>
                <span>🔥</span>
                <strong className="acgm-num">{profile.streakDays}</strong>
                <small>{t(lang, 'streak')}</small>
              </article>
              <article>
                <span>★</span>
                <strong className="acgm-num">
                  {profile.totalGames} ({avgAccuracy}%)
                </strong>
                <small>{t(lang, 'games')} · avg accuracy</small>
              </article>
            </div>

            <div className="content-grid">
              <section className="card">
                <h2>{t(lang, 'progress')}</h2>
                <div className="progress">
                  <span style={{ width: `${Math.min(100, (completedToday / 3) * 100)}%` }} />
                </div>
                <p>{completedToday} / 3 daily activities completed today.</p>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setShowLab(true)}
                >
                  Launch 6 Advanced Exercises →
                </button>
              </section>

              <section className="card games-card">
                <h2>Daily warm-up classics</h2>
                {(['memory', 'numbers', 'words'] as ClassicGameKind[]).map((g) => (
                  <button
                    type="button"
                    className="game-row playable"
                    onClick={() => setActiveClassic(g)}
                    key={g}
                  >
                    <span className="game-icon">
                      {g === 'memory' ? '🧠' : g === 'numbers' ? '🔢' : '🔤'}
                    </span>
                    <span>
                      <strong>{GAME_LABELS[g].title}</strong>
                      <small>{GAME_LABELS[g].summary}</small>
                    </span>
                    <span className="play-badge">Play</span>
                  </button>
                ))}
              </section>

              <section className="card">
                <h2>Recent Firebase results</h2>
                {sessions.length ? (
                  sessions.slice(0, 6).map((r) => (
                    <div className="trend" key={r.id}>
                      <div>
                        <strong>{GAME_LABELS[r.gameId]?.title ?? r.gameId}</strong>
                        <small className="trend-sub">
                          {r.domain}
                          {r.avgReactionTimeMs > 0 ? ` · ${r.avgReactionTimeMs} ms` : ''}
                        </small>
                      </div>
                      <span className="acgm-num">
                        {r.score} ({r.accuracyPercent}%)
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="soft">Complete an exercise to record your first Firebase session.</p>
                )}
                <p className="soft">{t(lang, 'disclaimer')}</p>
              </section>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function GuestLab({
  onBack,
  onSignIn
}: {
  onBack: () => void;
  onSignIn: () => void;
}) {
  const [lastMetrics, setLastMetrics] = useState<SessionMetrics | null>(null);

  return (
    <main className="app-shell">
      <header>
        <div className="brand">✦ Bright Mind</div>
        <div className="header-actions">
          <button type="button" className="quiet" onClick={onSignIn}>
            Sign in with Google to save
          </button>
          <button type="button" className="quiet" onClick={onBack}>
            Home
          </button>
        </div>
      </header>
      <section className="dashboard">
        {lastMetrics && (
          <p className="notice">
            Completed {GAME_LABELS[lastMetrics.gameId].title} — Score: {lastMetrics.score}, Accuracy:{' '}
            {lastMetrics.accuracyPercent}%, Avg RT: {lastMetrics.avgReactionTimeMs} ms. Sign in with Google to save future sessions to Firebase.
          </p>
        )}
        <AdvancedCognitiveGamesModule
          onSessionComplete={(m) => setLastMetrics(m)}
          onExitModule={onBack}
        />
      </section>
    </main>
  );
}

function App() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<FirebaseUserProfile | null>(null);
  const [sessions, setSessions] = useState<CognitiveSessionRecord[]>([]);
  const [authReady, setAuthReady] = useState(false);
  const [view, setView] = useState<'landing' | 'auth' | 'guest-lab'>('landing');
  const [syncError, setSyncError] = useState('');

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
      if (user) {
        try {
          await ensureUserProfile(user);
        } catch (err) {
          setSyncError(err instanceof Error ? err.message : String(err));
        }
      } else {
        setProfile(null);
        setSessions([]);
      }
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;
    const unsubProfile = subscribeUserProfile(
      firebaseUser.uid,
      (p) => setProfile(p),
      (err) => setSyncError(err.message)
    );
    const unsubSessions = subscribeUserSessions(
      firebaseUser.uid,
      (list) => setSessions(list),
      (err) => setSyncError(err.message)
    );
    return () => {
      unsubProfile();
      unsubSessions();
    };
  }, [firebaseUser]);

  if (!authReady) {
    return <main className="auth-shell">Loading…</main>;
  }

  if (syncError) {
    throw new Error(syncError);
  }

  if (firebaseUser && profile) {
    return <Dashboard firebaseUser={firebaseUser} profile={profile} sessions={sessions} />;
  }

  if (firebaseUser && !profile) {
    return <main className="auth-shell">Preparing your Bright Mind profile…</main>;
  }

  if (view === 'guest-lab') {
    return (
      <GuestLab
        onBack={() => setView('landing')}
        onSignIn={() => void signInWithGoogle().catch((e) => setSyncError(String(e)))}
      />
    );
  }

  if (view === 'auth') {
    return (
      <Auth
        onCancel={() => setView('landing')}
        onGuestLab={() => setView('guest-lab')}
      />
    );
  }

  return (
    <Landing
      start={() => setView('auth')}
      openLab={() => setView('guest-lab')}
    />
  );
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
    <OfflineIndicator />
  </ErrorBoundary>
);
