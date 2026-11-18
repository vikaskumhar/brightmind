import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type AdvancedGameId =
  | 'mental-rotation'
  | 'trail-making-ab'
  | 'corsi-span'
  | 'calcudoku-4x4'
  | 'rvip-vigilance'
  | 'anagrams-fluency';

export interface SessionMetrics {
  gameId: AdvancedGameId;
  domain: string;
  score: number;
  accuracyPercent: number;
  avgReactionTimeMs: number;
  durationSeconds: number;
}

export interface AdvancedCognitiveGamesModuleProps {
  onSessionComplete: (metrics: SessionMetrics) => void;
  initialGameId?: AdvancedGameId;
  soundEnabled?: boolean;
  highContrast?: boolean;
  onExitModule?: () => void;
}

interface GameCatalogItem {
  id: AdvancedGameId;
  indexLabel: string;
  title: string;
  domain: string;
  instruction: string;
  durationHint: string;
}

const GAME_CATALOG: GameCatalogItem[] = [
  {
    id: 'mental-rotation',
    indexLabel: '01',
    title: 'Mental Rotation Grid',
    domain: 'Visuospatial Manipulation',
    instruction: 'Select the candidate grid that matches the target shape rotated by 90°, 180°, or 270°.',
    durationHint: '12 rounds'
  },
  {
    id: 'trail-making-ab',
    indexLabel: '02',
    title: 'Trail Making Test A & B',
    domain: 'Visual Attention & Task-Switching',
    instruction: 'Tap circles in strict alternating ascending order: 1 → A → 2 → B → 3 → C through 8 → H.',
    durationHint: '16 targets'
  },
  {
    id: 'corsi-span',
    indexLabel: '03',
    title: 'Corsi Block-Tapping Span',
    domain: 'Visuospatial Working Memory',
    instruction: 'Watch the illuminated blocks, then tap them in Forward order on odd rounds and Reverse order on even rounds.',
    durationHint: 'Adaptive span'
  },
  {
    id: 'calcudoku-4x4',
    indexLabel: '04',
    title: 'Calcudoku 4×4',
    domain: 'Numerical Logic & Constraint Satisfaction',
    instruction: 'Fill every row and column with digits 1–4 without repeats while satisfying each cage arithmetic target.',
    durationHint: 'Logic grid'
  },
  {
    id: 'rvip-vigilance',
    indexLabel: '05',
    title: 'Rapid Visual Processing (RVIP)',
    domain: 'Sustained Vigilance',
    instruction: 'Press Target Sequence (or Space) whenever three consecutive odd digits or three consecutive even digits appear.',
    durationHint: '60 seconds'
  },
  {
    id: 'anagrams-fluency',
    indexLabel: '06',
    title: 'Anagrams & Word Unscrambler',
    domain: 'Verbal Fluency & Lexical Retrieval',
    instruction: 'Unscramble each 6-to-7-letter word within 60 seconds; consecutive solves build a streak bonus.',
    durationHint: '60 seconds'
  }
];

/* -------------------------------------------------------------------------- */
/* Optional Web Audio Synthesizer (Zero External Dependencies)                */
/* -------------------------------------------------------------------------- */

function playCue(enabled: boolean, kind: 'tap' | 'good' | 'bad' | 'done'): void {
  if (!enabled || typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (kind === 'tap') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.085);
    } else if (kind === 'good') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.setValueAtTime(783.99, now + 0.07);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.start(now);
      osc.stop(now + 0.23);
    } else if (kind === 'bad') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(210, now);
      osc.frequency.setValueAtTime(165, now + 0.09);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.21);
    } else {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.09);
      osc.frequency.setValueAtTime(783.99, now + 0.18);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      osc.start(now);
      osc.stop(now + 0.4);
    }

    window.setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 500);
  } catch {
    // Ignore audio context restrictions
  }
}

function mean(values: number[]): number {
  if (!values.length) return 0;
  return Math.round(values.reduce((acc, v) => acc + v, 0) / values.length);
}

function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/* -------------------------------------------------------------------------- */
/* GAME 1: Mental Rotation 2D/3D Grid (12 Rounds)                             */
/* -------------------------------------------------------------------------- */

type Grid5 = boolean[][];

function emptyGrid5(): Grid5 {
  return Array.from({ length: 5 }, () => Array<boolean>(5).fill(false));
}

function cloneGrid5(g: Grid5): Grid5 {
  return g.map((row) => [...row]);
}

function rotate90Grid5(g: Grid5): Grid5 {
  const out = emptyGrid5();
  for (let r = 0; r < 5; r += 1) {
    for (let c = 0; c < 5; c += 1) {
      out[c][4 - r] = g[r][c];
    }
  }
  return out;
}

function flipHGrid5(g: Grid5): Grid5 {
  return g.map((row) => [...row].reverse());
}

function normalizeGrid5(g: Grid5): Grid5 {
  const cells: [number, number][] = [];
  for (let r = 0; r < 5; r += 1) {
    for (let c = 0; c < 5; c += 1) {
      if (g[r][c]) cells.push([r, c]);
    }
  }
  if (!cells.length) return g;
  const minR = Math.min(...cells.map(([r]) => r));
  const maxR = Math.max(...cells.map(([r]) => r));
  const minC = Math.min(...cells.map(([, c]) => c));
  const maxC = Math.max(...cells.map(([, c]) => c));
  const height = maxR - minR + 1;
  const width = maxC - minC + 1;
  const offR = Math.floor((5 - height) / 2);
  const offC = Math.floor((5 - width) / 2);

  const out = emptyGrid5();
  for (const [r, c] of cells) {
    out[r - minR + offR][c - minC + offC] = true;
  }
  return out;
}

function gridKey(g: Grid5): string {
  return normalizeGrid5(g)
    .map((row) => row.map((v) => (v ? '1' : '0')).join(''))
    .join('/');
}

function isAsymmetricPolyomino(g: Grid5): boolean {
  const r0 = normalizeGrid5(g);
  const r90 = normalizeGrid5(rotate90Grid5(r0));
  const r180 = normalizeGrid5(rotate90Grid5(r90));
  const r270 = normalizeGrid5(rotate90Grid5(r180));
  const f0 = normalizeGrid5(flipHGrid5(r0));
  const f90 = normalizeGrid5(rotate90Grid5(f0));
  const f180 = normalizeGrid5(rotate90Grid5(f90));
  const f270 = normalizeGrid5(rotate90Grid5(f180));

  const keys = new Set([r0, r90, r180, r270, f0, f90, f180, f270].map(gridKey));
  return keys.size === 8;
}

function generateAsymmetricPolyomino(): Grid5 {
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ];
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const g = emptyGrid5();
    const cells: [number, number][] = [[2, 2]];
    g[2][2] = true;
    const targetSize = 6 + (attempt % 2);

    while (cells.length < targetSize) {
      const frontier: [number, number][] = [];
      for (const [r, c] of cells) {
        for (const [dr, dc] of dirs) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < 5 && nc >= 0 && nc < 5 && !g[nr][nc]) {
            frontier.push([nr, nc]);
          }
        }
      }
      if (!frontier.length) break;
      const [nr, nc] = frontier[Math.floor(Math.random() * frontier.length)];
      g[nr][nc] = true;
      cells.push([nr, nc]);
    }

    const normalized = normalizeGrid5(g);
    if (isAsymmetricPolyomino(normalized)) {
      return normalized;
    }
  }

  // Deterministic asymmetrical fallback
  const fallback = emptyGrid5();
  [
    [1, 1],
    [1, 2],
    [2, 2],
    [3, 2],
    [3, 3],
    [2, 0]
  ].forEach(([r, c]) => {
    fallback[r][c] = true;
  });
  return normalizeGrid5(fallback);
}

function mutatePolyomino(g: Grid5): Grid5 {
  const occupied: [number, number][] = [];
  const adjacentEmpty: [number, number][] = [];
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ];

  for (let r = 0; r < 5; r += 1) {
    for (let c = 0; c < 5; c += 1) {
      if (g[r][c]) {
        occupied.push([r, c]);
      } else {
        const touches = dirs.some(([dr, dc]) => {
          const nr = r + dr;
          const nc = c + dc;
          return nr >= 0 && nr < 5 && nc >= 0 && nc < 5 && g[nr][nc];
        });
        if (touches) adjacentEmpty.push([r, c]);
      }
    }
  }

  const copy = cloneGrid5(g);
  if (occupied.length > 4 && adjacentEmpty.length > 0) {
    const [remR, remC] = occupied[Math.floor(Math.random() * occupied.length)];
    const [addR, addC] = adjacentEmpty[Math.floor(Math.random() * adjacentEmpty.length)];
    copy[remR][remC] = false;
    copy[addR][addC] = true;
  }
  return normalizeGrid5(copy);
}

interface RotationRound {
  target: Grid5;
  rotationLabel: string;
  candidates: { grid: Grid5; isMatch: boolean }[];
}

function buildRotationRound(): RotationRound {
  const target = generateAsymmetricPolyomino();
  const r90 = normalizeGrid5(rotate90Grid5(target));
  const r180 = normalizeGrid5(rotate90Grid5(r90));
  const r270 = normalizeGrid5(rotate90Grid5(r180));

  const rotOptions: [Grid5, string][] = [
    [r90, '90°'],
    [r180, '180°'],
    [r270, '270°']
  ];
  const [matchGrid, rotationLabel] = rotOptions[Math.floor(Math.random() * rotOptions.length)];

  const f0 = normalizeGrid5(flipHGrid5(target));
  const f90 = normalizeGrid5(rotate90Grid5(f0));
  const f180 = normalizeGrid5(rotate90Grid5(f90));
  const f270 = normalizeGrid5(rotate90Grid5(f180));

  const seenKeys = new Set<string>([gridKey(target), gridKey(matchGrid)]);
  const decoys: Grid5[] = [];

  for (const mirrored of shuffleArray([f0, f90, f180, f270])) {
    const k = gridKey(mirrored);
    if (!seenKeys.has(k) && decoys.length < 2) {
      seenKeys.add(k);
      decoys.push(mirrored);
    }
  }

  let guard = 0;
  while (decoys.length < 3 && guard < 100) {
    guard += 1;
    const base = [target, matchGrid, f90][guard % 3];
    const mutated = mutatePolyomino(base);
    const k = gridKey(mutated);
    if (!seenKeys.has(k)) {
      seenKeys.add(k);
      decoys.push(mutated);
    }
  }

  while (decoys.length < 3) {
    decoys.push(f270);
  }

  const candidates = shuffleArray([
    { grid: matchGrid, isMatch: true },
    ...decoys.slice(0, 3).map((grid) => ({ grid, isMatch: false }))
  ]);

  return { target, rotationLabel, candidates };
}

function MiniPolyominoGrid({
  grid,
  accent = false,
  size = 'md'
}: {
  grid: Grid5;
  accent?: boolean;
  size?: 'lg' | 'md';
}) {
  return (
    <div className={`acgm-poly-grid ${size === 'lg' ? 'acgm-poly-lg' : ''}`} aria-hidden="true">
      {grid.flatMap((row, r) =>
        row.map((filled, c) => (
          <span
            key={`${r}-${c}`}
            className={`acgm-poly-cell ${filled ? (accent ? 'is-target' : 'is-filled') : ''}`}
          />
        ))
      )}
    </div>
  );
}

function MentalRotationGame({
  soundEnabled,
  onComplete
}: {
  soundEnabled: boolean;
  onComplete: (metrics: SessionMetrics) => void;
}) {
  const TOTAL_ROUNDS = 12;
  const [roundIdx, setRoundIdx] = useState(0);
  const [roundData, setRoundData] = useState<RotationRound>(() => buildRotationRound());
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  const roundStartRef = useRef<number>(performance.now());
  const sessionStartRef = useRef<number>(performance.now());

  useEffect(() => {
    roundStartRef.current = performance.now();
  }, [roundIdx]);

  const handleSelect = useCallback(
    (idx: number) => {
      if (selectedIdx !== null) return;
      const rt = Math.max(120, Math.round(performance.now() - roundStartRef.current));
      const isCorrect = roundData.candidates[idx].isMatch;
      setSelectedIdx(idx);
      playCue(soundEnabled, isCorrect ? 'good' : 'bad');

      const nextCorrect = correctCount + (isCorrect ? 1 : 0);
      const nextRts = [...reactionTimes, rt];
      setCorrectCount(nextCorrect);
      setReactionTimes(nextRts);

      window.setTimeout(() => {
        if (roundIdx + 1 >= TOTAL_ROUNDS) {
          const durationSeconds = Math.max(1, Math.round((performance.now() - sessionStartRef.current) / 1000));
          const accuracyPercent = Math.round((nextCorrect / TOTAL_ROUNDS) * 100);
          const avgRt = mean(nextRts);
          const speedBonus = Math.max(0, Math.min(20, Math.round((4500 - avgRt) / 200)));
          const score = Math.min(100, Math.max(0, Math.round(accuracyPercent * 0.8 + (accuracyPercent > 0 ? speedBonus : 0))));
          playCue(soundEnabled, 'done');
          onComplete({
            gameId: 'mental-rotation',
            domain: 'Visuospatial Manipulation',
            score,
            accuracyPercent,
            avgReactionTimeMs: avgRt,
            durationSeconds
          });
        } else {
          setRoundIdx((r) => r + 1);
          setRoundData(buildRotationRound());
          setSelectedIdx(null);
        }
      }, 480);
    },
    [selectedIdx, roundData, correctCount, reactionTimes, roundIdx, soundEnabled, onComplete]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '1' && e.key <= '4') {
        handleSelect(Number(e.key) - 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSelect]);

  return (
    <div className="acgm-stage">
      <div className="acgm-hud-row">
        <div className="acgm-metric">
          <span>Round</span>
          <strong className="acgm-num">
            {roundIdx + 1} / {TOTAL_ROUNDS}
          </strong>
        </div>
        <div className="acgm-metric">
          <span>Correct</span>
          <strong className="acgm-num">{correctCount}</strong>
        </div>
        <div className="acgm-metric">
          <span>Keys</span>
          <strong>1–4 or Tap</strong>
        </div>
      </div>

      <div className="acgm-mr-layout">
        <div className="acgm-mr-target-box">
          <p className="acgm-sublabel">Target Shape</p>
          <MiniPolyominoGrid grid={roundData.target} accent size="lg" />
        </div>

        <div className="acgm-mr-candidates">
          {roundData.candidates.map((cand, idx) => {
            const isChosen = selectedIdx === idx;
            const showResult = selectedIdx !== null;
            let stateClass = '';
            if (showResult) {
              if (cand.isMatch) stateClass = 'is-correct';
              else if (isChosen) stateClass = 'is-wrong';
            }
            return (
              <button
                key={idx}
                type="button"
                disabled={selectedIdx !== null}
                onClick={() => handleSelect(idx)}
                className={`acgm-mr-option ${stateClass}`}
                aria-label={`Option ${idx + 1}`}
              >
                <span className="acgm-option-index">{idx + 1}</span>
                <MiniPolyominoGrid grid={cand.grid} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* GAME 2: Trail Making Test A & B (16 Alternating Nodes)                     */
/* -------------------------------------------------------------------------- */

interface TrailNode {
  label: string;
  x: number; // percentage 10..90
  y: number; // percentage 12..88
}

const TRAIL_SEQUENCE = ['1', 'A', '2', 'B', '3', 'C', '4', 'D', '5', 'E', '6', 'F', '7', 'G', '8', 'H'];

function generateTrailNodes(): TrailNode[] {
  const nodes: TrailNode[] = [];
  let minDist = 17;

  for (const label of TRAIL_SEQUENCE) {
    let placed = false;
    for (let attempt = 0; attempt < 250; attempt += 1) {
      const x = 9 + Math.random() * 82;
      const y = 12 + Math.random() * 76;
      const ok = nodes.every((n) => {
        const dx = (n.x - x) * 1.35;
        const dy = n.y - y;
        return Math.hypot(dx, dy) >= minDist;
      });
      if (ok) {
        nodes.push({ label, x, y });
        placed = true;
        break;
      }
    }
    if (!placed) {
      minDist = Math.max(10, minDist - 3);
      nodes.push({
        label,
        x: 12 + ((nodes.length * 23) % 76),
        y: 14 + ((nodes.length * 31) % 72)
      });
    }
  }
  return nodes;
}

function TrailMakingGame({
  soundEnabled,
  onComplete
}: {
  soundEnabled: boolean;
  onComplete: (metrics: SessionMetrics) => void;
}) {
  const [nodes] = useState<TrailNode[]>(() => generateTrailNodes());
  const [nextIdx, setNextIdx] = useState(0);
  const [errors, setErrors] = useState(0);
  const [errorNodeLabel, setErrorNodeLabel] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const intervalsRef = useRef<number[]>([]);
  const lastTapRef = useRef<number>(performance.now());
  const startRef = useRef<number>(performance.now());
  const finishedRef = useRef(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!finishedRef.current) {
        setElapsedSec(Math.floor((performance.now() - startRef.current) / 1000));
      }
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  const handleNodeClick = (idx: number) => {
    if (finishedRef.current || idx < nextIdx) return;

    if (idx === nextIdx) {
      const now = performance.now();
      intervalsRef.current.push(Math.round(now - lastTapRef.current));
      lastTapRef.current = now;
      setErrorNodeLabel(null);
      const upcoming = nextIdx + 1;
      setNextIdx(upcoming);

      if (upcoming >= nodes.length) {
        finishedRef.current = true;
        const durationSeconds = Math.max(1, Math.round((now - startRef.current) / 1000));
        const accuracyPercent = Math.round((16 / (16 + errors)) * 100);
        const avgRt = mean(intervalsRef.current);
        const speedComponent = Math.max(0, Math.min(40, Math.round((45 - durationSeconds) * 1.1)));
        const score = Math.min(100, Math.max(15, Math.round(accuracyPercent * 0.6 + speedComponent)));
        playCue(soundEnabled, 'done');
        window.setTimeout(() => {
          onComplete({
            gameId: 'trail-making-ab',
            domain: 'Visual Attention & Task-Switching',
            score,
            accuracyPercent,
            avgReactionTimeMs: avgRt,
            durationSeconds
          });
        }, 350);
      } else {
        playCue(soundEnabled, 'tap');
      }
    } else {
      playCue(soundEnabled, 'bad');
      setErrors((e) => e + 1);
      setErrorNodeLabel(nodes[idx].label);
      window.setTimeout(() => {
        setErrorNodeLabel((curr) => (curr === nodes[idx].label ? null : curr));
      }, 450);
    }
  };

  return (
    <div className="acgm-stage">
      <div className="acgm-hud-row">
        <div className="acgm-metric">
          <span>Next Target</span>
          <strong className="acgm-num">{nextIdx < nodes.length ? nodes[nextIdx].label : 'Done'}</strong>
        </div>
        <div className="acgm-metric">
          <span>Progress</span>
          <strong className="acgm-num">
            {nextIdx} / {nodes.length}
          </strong>
        </div>
        <div className="acgm-metric">
          <span>Errors</span>
          <strong className="acgm-num">{errors}</strong>
        </div>
        <div className="acgm-metric">
          <span>Elapsed</span>
          <strong className="acgm-num">{elapsedSec}s</strong>
        </div>
      </div>

      <div className="acgm-trail-board" role="application" aria-label="Trail Making Test canvas">
        <svg className="acgm-trail-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {nextIdx > 1 &&
            nodes.slice(0, nextIdx - 1).map((node, idx) => {
              const target = nodes[idx + 1];
              return (
                <line
                  key={`${node.label}-${target.label}`}
                  x1={node.x}
                  y1={node.y}
                  x2={target.x}
                  y2={target.y}
                  className="acgm-trail-line"
                />
              );
            })}
        </svg>

        {nodes.map((node, idx) => {
          const isCompleted = idx < nextIdx;
          const isError = errorNodeLabel === node.label;
          return (
            <button
              key={node.label}
              type="button"
              onClick={() => handleNodeClick(idx)}
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
              className={`acgm-trail-node ${isCompleted ? 'is-done' : ''} ${isError ? 'is-error' : ''}`}
              aria-label={`Target ${node.label}${isCompleted ? ', completed' : ''}`}
            >
              {node.label}
            </button>
          );
        })}
      </div>

      {errorNodeLabel && (
        <p className="acgm-inline-alert" role="status">
          Incorrect node ({errorNodeLabel}). Tap <strong>{nodes[nextIdx]?.label}</strong> next.
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* GAME 3: Corsi Block-Tapping Span (Forward on Odd, Reverse on Even)         */
/* -------------------------------------------------------------------------- */

const CORSI_POSITIONS: { x: number; y: number }[] = [
  { x: 16, y: 18 },
  { x: 48, y: 14 },
  { x: 82, y: 20 },
  { x: 28, y: 44 },
  { x: 64, y: 40 },
  { x: 14, y: 72 },
  { x: 44, y: 68 },
  { x: 78, y: 62 },
  { x: 60, y: 84 }
];

function generateCorsiSequence(length: number): number[] {
  const pool = shuffleArray([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  return pool.slice(0, Math.min(9, length));
}

function CorsiSpanGame({
  soundEnabled,
  onComplete
}: {
  soundEnabled: boolean;
  onComplete: (metrics: SessionMetrics) => void;
}) {
  const [round, setRound] = useState(1);
  const [spanLength, setSpanLength] = useState(3);
  const [consecutiveCorrect, setConsecutiveCorrect] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [maxSpanAchieved, setMaxSpanAchieved] = useState(2);
  const [roundsPassed, setRoundsPassed] = useState(0);

  const [sequence, setSequence] = useState<number[]>(() => generateCorsiSequence(3));
  const [phase, setPhase] = useState<'SHOWING' | 'INPUT' | 'FEEDBACK'>('SHOWING');
  const [litBlock, setLitBlock] = useState<number | null>(null);
  const [userTaps, setUserTaps] = useState<number[]>([]);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [lastTapState, setLastTapState] = useState<{ idx: number; ok: boolean } | null>(null);

  const reactionTimesRef = useRef<number[]>([]);
  const inputStartRef = useRef<number>(performance.now());
  const sessionStartRef = useRef<number>(performance.now());

  const isReverse = round % 2 === 0;
  const expectedSequence = useMemo(
    () => (isReverse ? [...sequence].reverse() : sequence),
    [sequence, isReverse]
  );

  useEffect(() => {
    if (phase !== 'SHOWING') return;
    let cancelled = false;
    const timers: number[] = [];

    sequence.forEach((blockIdx, stepIdx) => {
      const onTimer = window.setTimeout(() => {
        if (cancelled) return;
        setLitBlock(blockIdx);
        playCue(soundEnabled, 'tap');
      }, 450 + stepIdx * 820);

      const offTimer = window.setTimeout(() => {
        if (cancelled) return;
        setLitBlock(null);
      }, 450 + stepIdx * 820 + 560);

      timers.push(onTimer, offTimer);
    });

    const readyTimer = window.setTimeout(() => {
      if (cancelled) return;
      setLitBlock(null);
      setPhase('INPUT');
      inputStartRef.current = performance.now();
    }, 450 + sequence.length * 820 + 180);
    timers.push(readyTimer);

    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [phase, sequence, soundEnabled]);

  const finishSession = useCallback(
    (finalSpan: number, totalRoundsPlayed: number, passedCount: number) => {
      const durationSeconds = Math.max(1, Math.round((performance.now() - sessionStartRef.current) / 1000));
      const accuracyPercent = Math.round((passedCount / Math.max(1, totalRoundsPlayed)) * 100);
      const avgRt = mean(reactionTimesRef.current);
      const score = Math.min(100, Math.round((finalSpan / 9) * 75 + accuracyPercent * 0.25));
      playCue(soundEnabled, 'done');
      onComplete({
        gameId: 'corsi-span',
        domain: 'Visuospatial Working Memory',
        score,
        accuracyPercent,
        avgReactionTimeMs: avgRt,
        durationSeconds
      });
    },
    [onComplete, soundEnabled]
  );

  const advanceRound = useCallback(
    (nextSpan: number, nextRound: number) => {
      setRound(nextRound);
      setSpanLength(nextSpan);
      setUserTaps([]);
      setLastTapState(null);
      setFeedbackMsg('');
      setSequence(generateCorsiSequence(nextSpan));
      setPhase('SHOWING');
    },
    []
  );

  const handleBlockTap = (blockIdx: number) => {
    if (phase !== 'INPUT') return;
    const now = performance.now();
    reactionTimesRef.current.push(Math.round(now - inputStartRef.current));
    inputStartRef.current = now;

    const step = userTaps.length;
    const expected = expectedSequence[step];

    if (blockIdx === expected) {
      playCue(soundEnabled, 'tap');
      setLastTapState({ idx: blockIdx, ok: true });
      const nextTaps = [...userTaps, blockIdx];
      setUserTaps(nextTaps);

      if (nextTaps.length === expectedSequence.length) {
        const nextPassed = roundsPassed + 1;
        const nextMaxSpan = Math.max(maxSpanAchieved, spanLength);
        setRoundsPassed(nextPassed);
        setMaxSpanAchieved(nextMaxSpan);
        setPhase('FEEDBACK');
        setFeedbackMsg(`Correct (${isReverse ? 'Reverse' : 'Forward'} span ${spanLength}).`);
        playCue(soundEnabled, 'good');

        const nextConsec = consecutiveCorrect + 1;
        let nextSpan = spanLength;
        if (nextConsec >= 2) {
          nextSpan = Math.min(9, spanLength + 1);
          setConsecutiveCorrect(0);
        } else {
          setConsecutiveCorrect(nextConsec);
        }

        window.setTimeout(() => {
          if (spanLength === 9 && nextConsec >= 2) {
            finishSession(9, round, nextPassed);
          } else {
            advanceRound(nextSpan, round + 1);
          }
        }, 900);
      }
    } else {
      playCue(soundEnabled, 'bad');
      setLastTapState({ idx: blockIdx, ok: false });
      const nextMistakes = mistakes + 1;
      setMistakes(nextMistakes);
      setConsecutiveCorrect(0);
      setPhase('FEEDBACK');
      setFeedbackMsg(
        nextMistakes >= 2
          ? 'Two mistakes reached — session complete.'
          : 'Sequence mismatch. Watch the next round carefully.'
      );

      window.setTimeout(() => {
        if (nextMistakes >= 2) {
          finishSession(maxSpanAchieved, round, roundsPassed);
        } else {
          advanceRound(spanLength, round + 1);
        }
      }, 1050);
    }
  };

  return (
    <div className="acgm-stage">
      <div className="acgm-hud-row">
        <div className="acgm-metric">
          <span>Round</span>
          <strong className="acgm-num">{round}</strong>
        </div>
        <div className="acgm-metric">
          <span>Order Rule</span>
          <strong className={isReverse ? 'acgm-accent-warn' : 'acgm-accent-ok'}>
            {isReverse ? 'REVERSE' : 'FORWARD'}
          </strong>
        </div>
        <div className="acgm-metric">
          <span>Span Length</span>
          <strong className="acgm-num">{spanLength} blocks</strong>
        </div>
        <div className="acgm-metric">
          <span>Mistakes</span>
          <strong className="acgm-num">{mistakes} / 2</strong>
        </div>
      </div>

      <div className="acgm-corsi-status" role="status">
        {phase === 'SHOWING' && `Observe the sequence (${isReverse ? 'you will tap in REVERSE order' : 'you will tap in FORWARD order'})...`}
        {phase === 'INPUT' && `Tap ${spanLength} blocks in ${isReverse ? 'REVERSE' : 'FORWARD'} order (${userTaps.length}/${spanLength})`}
        {phase === 'FEEDBACK' && feedbackMsg}
      </div>

      <div className="acgm-corsi-board">
        {CORSI_POSITIONS.map((pos, idx) => {
          const isLit = litBlock === idx;
          const isTapped = userTaps.includes(idx);
          const isBad = lastTapState?.idx === idx && !lastTapState.ok;
          return (
            <button
              key={idx}
              type="button"
              disabled={phase !== 'INPUT'}
              onClick={() => handleBlockTap(idx)}
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              className={`acgm-corsi-block ${isLit ? 'is-lit' : ''} ${isTapped ? 'is-tapped' : ''} ${isBad ? 'is-error' : ''}`}
              aria-label={`Block ${idx + 1}`}
            >
              <span className="acgm-sr-only">Block {idx + 1}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* GAME 4: Calcudoku / Mini KenKen 4x4                                        */
/* -------------------------------------------------------------------------- */

type CalcOp = '' | '+' | '-' | '×' | '÷';

interface CalcCage {
  id: number;
  cells: [number, number][];
  op: CalcOp;
  target: number;
}

interface CalcPuzzle {
  solution: number[][];
  cages: CalcCage[];
  cellToCage: number[][];
}

function generateLatinSquare4(): number[][] {
  const base = [
    [1, 2, 3, 4],
    [2, 1, 4, 3],
    [3, 4, 1, 2],
    [4, 3, 2, 1]
  ];
  const rowPerm = shuffleArray([0, 1, 2, 3]);
  const colPerm = shuffleArray([0, 1, 2, 3]);
  const symPerm = shuffleArray([1, 2, 3, 4]);

  return rowPerm.map((r) => colPerm.map((c) => symPerm[base[r][c] - 1]));
}

function generateCalcudokuPuzzle(): CalcPuzzle {
  const solution = generateLatinSquare4();
  const assigned = Array.from({ length: 4 }, () => Array<number>(4).fill(-1));
  const cages: CalcCage[] = [];
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ];

  let cageId = 0;
  for (let r = 0; r < 4; r += 1) {
    for (let c = 0; c < 4; c += 1) {
      if (assigned[r][c] !== -1) continue;
      const cells: [number, number][] = [[r, c]];
      assigned[r][c] = cageId;
      const desiredSize = Math.random() < 0.25 ? 3 : Math.random() < 0.9 ? 2 : 1;

      while (cells.length < desiredSize) {
        const neighbors: [number, number][] = [];
        for (const [cr, cc] of cells) {
          for (const [dr, dc] of dirs) {
            const nr = cr + dr;
            const nc = cc + dc;
            if (nr >= 0 && nr < 4 && nc >= 0 && nc < 4 && assigned[nr][nc] === -1) {
              neighbors.push([nr, nc]);
            }
          }
        }
        if (!neighbors.length) break;
        const [nr, nc] = neighbors[Math.floor(Math.random() * neighbors.length)];
        assigned[nr][nc] = cageId;
        cells.push([nr, nc]);
      }

      const vals = cells.map(([cr, cc]) => solution[cr][cc]);
      let op: CalcOp = '';
      let target = vals[0];

      if (cells.length === 2) {
        const [a, b] = vals;
        const hi = Math.max(a, b);
        const lo = Math.min(a, b);
        const candidates: [CalcOp, number][] = [
          ['+', a + b],
          ['-', hi - lo],
          ['×', a * b]
        ];
        if (hi % lo === 0) {
          candidates.push(['÷', hi / lo]);
          candidates.push(['÷', hi / lo]);
        }
        const picked = candidates[Math.floor(Math.random() * candidates.length)];
        op = picked[0];
        target = picked[1];
      } else if (cells.length === 3) {
        if (Math.random() < 0.65) {
          op = '+';
          target = vals.reduce((acc, v) => acc + v, 0);
        } else {
          op = '×';
          target = vals.reduce((acc, v) => acc * v, 1);
        }
      }

      // Sort cells so anchor is top-left-most cell
      cells.sort((a, b) => (a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1]));
      cages.push({ id: cageId, cells, op, target });
      cageId += 1;
    }
  }

  return { solution, cages, cellToCage: assigned };
}

function evaluateCage(values: number[], op: CalcOp, target: number): boolean {
  if (values.some((v) => v === 0)) return false;
  if (op === '') return values[0] === target;
  if (op === '+') return values.reduce((a, b) => a + b, 0) === target;
  if (op === '×') return values.reduce((a, b) => a * b, 1) === target;
  if (op === '-') return Math.abs(values[0] - values[1]) === target;
  if (op === '÷') {
    const hi = Math.max(values[0], values[1]);
    const lo = Math.min(values[0], values[1]);
    return lo !== 0 && hi / lo === target;
  }
  return false;
}

function CalcudokuGame({
  soundEnabled,
  onComplete
}: {
  soundEnabled: boolean;
  onComplete: (metrics: SessionMetrics) => void;
}) {
  const [puzzle] = useState<CalcPuzzle>(() => generateCalcudokuPuzzle());
  const [board, setBoard] = useState<number[][]>(() =>
    Array.from({ length: 4 }, () => Array<number>(4).fill(0))
  );
  const [selected, setSelected] = useState<[number, number]>([0, 0]);
  const [errorCells, setErrorCells] = useState<Set<string>>(new Set());
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [checksCount, setChecksCount] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);

  const editTimesRef = useRef<number[]>([]);
  const lastEditRef = useRef<number>(performance.now());
  const startRef = useRef<number>(performance.now());
  const doneRef = useRef(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!doneRef.current) {
        setElapsedSec(Math.floor((performance.now() - startRef.current) / 1000));
      }
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  const anchorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const cage of puzzle.cages) {
      const [ar, ac] = cage.cells[0];
      map.set(`${ar}-${ac}`, `${cage.target}${cage.op}`);
    }
    return map;
  }, [puzzle]);

  const setCellValue = useCallback(
    (val: number) => {
      if (doneRef.current) return;
      const [sr, sc] = selected;
      const now = performance.now();
      editTimesRef.current.push(Math.round(now - lastEditRef.current));
      lastEditRef.current = now;
      playCue(soundEnabled, 'tap');

      setBoard((prev) => prev.map((row, r) => row.map((cell, c) => (r === sr && c === sc ? val : cell))));
      setErrorCells(new Set());
      setStatusMsg('');
    },
    [selected, soundEnabled]
  );

  const checkSolution = useCallback(() => {
    if (doneRef.current) return;
    const bad = new Set<string>();
    const issues: string[] = [];

    // Check empty cells
    let emptyCount = 0;
    for (let r = 0; r < 4; r += 1) {
      for (let c = 0; c < 4; c += 1) {
        if (board[r][c] === 0) {
          emptyCount += 1;
          bad.add(`${r}-${c}`);
        }
      }
    }
    if (emptyCount > 0) {
      issues.push(`${emptyCount} cell${emptyCount > 1 ? 's' : ''} still empty`);
    }

    // Check row & column uniqueness
    for (let i = 0; i < 4; i += 1) {
      const rowSeen = new Map<number, number[]>();
      const colSeen = new Map<number, number[]>();
      for (let j = 0; j < 4; j += 1) {
        const rv = board[i][j];
        if (rv > 0) rowSeen.set(rv, [...(rowSeen.get(rv) || []), j]);
        const cv = board[j][i];
        if (cv > 0) colSeen.set(cv, [...(colSeen.get(cv) || []), j]);
      }
      for (const cols of rowSeen.values()) {
        if (cols.length > 1) {
          cols.forEach((c) => bad.add(`${i}-${c}`));
          issues.push(`duplicate in row ${i + 1}`);
        }
      }
      for (const rows of colSeen.values()) {
        if (rows.length > 1) {
          rows.forEach((r) => bad.add(`${r}-${i}`));
          issues.push(`duplicate in column ${i + 1}`);
        }
      }
    }

    // Check every cage arithmetic
    for (const cage of puzzle.cages) {
      const vals = cage.cells.map(([r, c]) => board[r][c]);
      if (vals.every((v) => v > 0) && !evaluateCage(vals, cage.op, cage.target)) {
        cage.cells.forEach(([r, c]) => bad.add(`${r}-${c}`));
        issues.push(`cage ${cage.target}${cage.op} mismatch`);
      }
    }

    if (bad.size === 0 && emptyCount === 0) {
      doneRef.current = true;
      const durationSeconds = Math.max(1, Math.round((performance.now() - startRef.current) / 1000));
      const accuracyPercent = Math.max(40, Math.round(100 - checksCount * 10));
      const avgRt = mean(editTimesRef.current);
      const speedBonus = Math.max(0, Math.min(20, Math.round((120 - durationSeconds) / 5)));
      const score = Math.min(100, Math.round(accuracyPercent * 0.8 + speedBonus));
      playCue(soundEnabled, 'done');
      onComplete({
        gameId: 'calcudoku-4x4',
        domain: 'Numerical Logic & Constraint Satisfaction',
        score,
        accuracyPercent,
        avgReactionTimeMs: avgRt,
        durationSeconds
      });
    } else {
      playCue(soundEnabled, 'bad');
      setChecksCount((c) => c + 1);
      setErrorCells(bad);
      setStatusMsg(`Needs review: ${[...new Set(issues)].slice(0, 3).join(', ')}.`);
    }
  }, [board, puzzle.cages, checksCount, soundEnabled, onComplete]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '1' && e.key <= '4') {
        setCellValue(Number(e.key));
      } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
        setCellValue(0);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelected(([r, c]) => [Math.max(0, r - 1), c]);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelected(([r, c]) => [Math.min(3, r + 1), c]);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setSelected(([r, c]) => [r, Math.max(0, c - 1)]);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setSelected(([r, c]) => [r, Math.min(3, c + 1)]);
      } else if (e.key === 'Enter') {
        checkSolution();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setCellValue, checkSolution]);

  return (
    <div className="acgm-stage">
      <div className="acgm-hud-row">
        <div className="acgm-metric">
          <span>Grid</span>
          <strong>4 × 4 (Digits 1–4)</strong>
        </div>
        <div className="acgm-metric">
          <span>Checks</span>
          <strong className="acgm-num">{checksCount}</strong>
        </div>
        <div className="acgm-metric">
          <span>Elapsed</span>
          <strong className="acgm-num">{elapsedSec}s</strong>
        </div>
      </div>

      <div className="acgm-calc-layout">
        <div className="acgm-calc-grid" role="grid" aria-label="4 by 4 Calcudoku puzzle">
          {board.map((row, r) =>
            row.map((val, c) => {
              const cageId = puzzle.cellToCage[r][c];
              const topSame = r > 0 && puzzle.cellToCage[r - 1][c] === cageId;
              const bottomSame = r < 3 && puzzle.cellToCage[r + 1][c] === cageId;
              const leftSame = c > 0 && puzzle.cellToCage[r][c - 1] === cageId;
              const rightSame = c < 3 && puzzle.cellToCage[r][c + 1] === cageId;

              const isSelected = selected[0] === r && selected[1] === c;
              const isError = errorCells.has(`${r}-${c}`);
              const clue = anchorMap.get(`${r}-${c}`);

              return (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  onClick={() => setSelected([r, c])}
                  className={`acgm-calc-cell ${isSelected ? 'is-selected' : ''} ${isError ? 'is-error' : ''}`}
                  style={{
                    borderTopWidth: topSame ? '1px' : '3px',
                    borderBottomWidth: bottomSame ? '1px' : '3px',
                    borderLeftWidth: leftSame ? '1px' : '3px',
                    borderRightWidth: rightSame ? '1px' : '3px',
                    borderTopColor: topSame ? 'var(--acgm-border-soft)' : 'var(--acgm-ink)',
                    borderBottomColor: bottomSame ? 'var(--acgm-border-soft)' : 'var(--acgm-ink)',
                    borderLeftColor: leftSame ? 'var(--acgm-border-soft)' : 'var(--acgm-ink)',
                    borderRightColor: rightSame ? 'var(--acgm-border-soft)' : 'var(--acgm-ink)'
                  }}
                  aria-label={`Row ${r + 1} Column ${c + 1}${clue ? `, Cage ${clue}` : ''}, value ${val || 'empty'}`}
                >
                  {clue && <span className="acgm-cage-clue">{clue}</span>}
                  <span className="acgm-calc-val">{val || ''}</span>
                </button>
              );
            })
          )}
        </div>

        <div className="acgm-calc-controls">
          <div className="acgm-keypad">
            {[1, 2, 3, 4].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => setCellValue(num)}
                className="acgm-key-btn"
              >
                {num}
              </button>
            ))}
            <button type="button" onClick={() => setCellValue(0)} className="acgm-key-btn acgm-key-clear">
              Erase
            </button>
          </div>
          <button type="button" onClick={checkSolution} className="acgm-primary-btn">
            Check Solution
          </button>
          {statusMsg && (
            <p className="acgm-inline-alert" role="status">
              {statusMsg}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* GAME 5: Rapid Visual Information Processing (RVIP — 60s, 600ms/digit)      */
/* -------------------------------------------------------------------------- */

interface RvipStream {
  digits: number[];
  targetEndIndices: number[]; // indices where digit[i-2], digit[i-1], digit[i] share parity
}

const ODD_DIGITS = [1, 3, 5, 7, 9];
const EVEN_DIGITS = [2, 4, 6, 8];

function pickDifferent(pool: number[], avoid?: number): number {
  const filtered = avoid === undefined ? pool : pool.filter((x) => x !== avoid);
  return filtered[Math.floor(Math.random() * filtered.length)];
}

function generateRvipStream(length = 100): RvipStream {
  const digits: number[] = [];
  const targetEndIndices: number[] = [];

  // Plan ~12 well-spaced target end indices between index 5 and length - 3
  const plannedStarts = new Set<number>();
  let cursor = 4 + Math.floor(Math.random() * 4);
  while (cursor < length - 5) {
    plannedStarts.add(cursor);
    cursor += 6 + Math.floor(Math.random() * 4);
  }

  let i = 0;
  while (i < length) {
    if (plannedStarts.has(i) && i + 2 < length) {
      const useOdd = Math.random() < 0.5;
      const pool = useOdd ? ODD_DIGITS : EVEN_DIGITS;
      // Ensure the preceding digit wasn't the same parity so triplet starts cleanly
      if (i > 0 && (digits[i - 1] % 2 === 1) === useOdd) {
        const opp = useOdd ? EVEN_DIGITS : ODD_DIGITS;
        digits[i - 1] = pickDifferent(opp, digits[i - 2]);
      }
      const d0 = pickDifferent(pool, digits[i - 1]);
      const d1 = pickDifferent(pool, d0);
      const d2 = pickDifferent(pool, d1);
      digits.push(d0, d1, d2);
      targetEndIndices.push(i + 2);
      i += 3;
      // Immediately follow with opposite parity so we never create a 4-in-a-row
      if (i < length) {
        const opp = useOdd ? EVEN_DIGITS : ODD_DIGITS;
        digits.push(pickDifferent(opp, d2));
        i += 1;
      }
      continue;
    }

    // Non-target digit: forbid 3 consecutive same parity
    const prev1Odd = i >= 1 ? digits[i - 1] % 2 === 1 : null;
    const prev2Odd = i >= 2 ? digits[i - 2] % 2 === 1 : null;
    let chooseOdd = Math.random() < 0.5;
    if (prev1Odd !== null && prev2Odd !== null && prev1Odd === prev2Odd) {
      chooseOdd = !prev1Odd;
    }
    const pool = chooseOdd ? ODD_DIGITS : EVEN_DIGITS;
    digits.push(pickDifferent(pool, digits[i - 1]));
    i += 1;
  }

  return { digits: digits.slice(0, length), targetEndIndices };
}

function RvipGame({
  soundEnabled,
  onComplete
}: {
  soundEnabled: boolean;
  onComplete: (metrics: SessionMetrics) => void;
}) {
  const TICK_MS = 600;
  const TOTAL_TICKS = 100; // 60 seconds total
  const [stream] = useState<RvipStream>(() => generateRvipStream(TOTAL_TICKS));
  const [tickIndex, setTickIndex] = useState(0);
  const [hits, setHits] = useState(0);
  const [falseAlarms, setFalseAlarms] = useState(0);
  const [flashStatus, setFlashStatus] = useState<'none' | 'hit' | 'false'>('none');

  const hitTargetsRef = useRef<Set<number>>(new Set());
  const targetOnsetMapRef = useRef<Map<number, number>>(new Map());
  const hitRtsRef = useRef<number[]>([]);
  const hitsRef = useRef(0);
  const falseAlarmsRef = useRef(0);
  const startRef = useRef<number>(performance.now());
  const doneRef = useRef(false);

  useEffect(() => {
    targetOnsetMapRef.current.set(0, performance.now());
    const interval = window.setInterval(() => {
      setTickIndex((prev) => {
        const next = prev + 1;
        if (next >= TOTAL_TICKS) {
          window.clearInterval(interval);
          // 900ms grace window after final digit before finalizing
          window.setTimeout(() => {
            if (doneRef.current) return;
            doneRef.current = true;
            const totalTargets = stream.targetEndIndices.length;
            const finalHits = hitsRef.current;
            const finalFalse = falseAlarmsRef.current;
            const accuracyPercent = Math.max(
              0,
              Math.min(100, Math.round(((finalHits - finalFalse * 0.5) / Math.max(1, totalTargets)) * 100))
            );
            const avgRt = mean(hitRtsRef.current);
            const durationSeconds = Math.max(1, Math.round((performance.now() - startRef.current) / 1000));
            playCue(soundEnabled, 'done');
            onComplete({
              gameId: 'rvip-vigilance',
              domain: 'Sustained Vigilance',
              score: accuracyPercent,
              accuracyPercent,
              avgReactionTimeMs: avgRt,
              durationSeconds
            });
          }, 900);
          return prev;
        }
        targetOnsetMapRef.current.set(next, performance.now());
        return next;
      });
    }, TICK_MS);

    return () => window.clearInterval(interval);
  }, [stream, soundEnabled, onComplete]);

  const handleTrigger = useCallback(() => {
    if (doneRef.current) return;
    const now = performance.now();

    // Check if any target ended within the last 1800ms (up to 3 ticks) and hasn't been claimed yet
    const matchedTarget = stream.targetEndIndices.find((endIdx) => {
      if (hitTargetsRef.current.has(endIdx)) return false;
      const onset = targetOnsetMapRef.current.get(endIdx);
      if (onset === undefined) return false;
      const delta = now - onset;
      return delta >= 0 && delta <= 1850;
    });

    if (matchedTarget !== undefined) {
      hitTargetsRef.current.add(matchedTarget);
      const onset = targetOnsetMapRef.current.get(matchedTarget) ?? now;
      hitRtsRef.current.push(Math.round(now - onset));
      hitsRef.current += 1;
      setHits(hitsRef.current);
      setFlashStatus('hit');
      playCue(soundEnabled, 'good');
    } else {
      falseAlarmsRef.current += 1;
      setFalseAlarms(falseAlarmsRef.current);
      setFlashStatus('false');
      playCue(soundEnabled, 'bad');
    }

    window.setTimeout(() => {
      setFlashStatus('none');
    }, 320);
  }, [stream, soundEnabled]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === 'Enter') {
        e.preventDefault();
        handleTrigger();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleTrigger]);

  const secondsLeft = Math.max(0, Math.ceil(((TOTAL_TICKS - 1 - tickIndex) * TICK_MS) / 1000));
  const missedSoFar = stream.targetEndIndices.filter(
    (endIdx) => endIdx < tickIndex - 3 && !hitTargetsRef.current.has(endIdx)
  ).length;

  return (
    <div className="acgm-stage">
      <div className="acgm-hud-row">
        <div className="acgm-metric">
          <span>Time Remaining</span>
          <strong className="acgm-num">{secondsLeft}s</strong>
        </div>
        <div className="acgm-metric">
          <span>Hits</span>
          <strong className="acgm-num">{hits}</strong>
        </div>
        <div className="acgm-metric">
          <span>Missed</span>
          <strong className="acgm-num">{missedSoFar}</strong>
        </div>
        <div className="acgm-metric">
          <span>False Alarms</span>
          <strong className="acgm-num">{falseAlarms}</strong>
        </div>
      </div>

      <div className="acgm-rvip-center">
        <div
          key={tickIndex}
          className={`acgm-rvip-digit ${flashStatus === 'hit' ? 'is-hit' : ''} ${flashStatus === 'false' ? 'is-false' : ''}`}
          aria-live="off"
        >
          {stream.digits[tickIndex]}
        </div>

        <button type="button" onClick={handleTrigger} className="acgm-rvip-btn">
          Target Sequence (Space)
        </button>

        <p className="acgm-muted-note">
          3 odd in a row (e.g. 3–7–5) or 3 even in a row (e.g. 2–8–4)
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* GAME 6: Anagrams & Word Unscrambler (160+ Adult Dictionary, 60s)           */
/* -------------------------------------------------------------------------- */

const ADULT_WORD_BANK: string[] = [
  'ANCHOR', 'ANIMAL', 'ANSWER', 'APPEAL', 'AROUND', 'ARRIVE', 'ARTIST', 'ASPECT',
  'AUTUMN', 'AVENUE', 'BAKERY', 'BALANCE', 'BANNER', 'BARREL', 'BASKET', 'BEACON',
  'BEAUTY', 'BECOME', 'BELIEF', 'BRANCH', 'BREATH', 'BRIDGE', 'BRIGHT', 'BROKEN',
  'BUDGET', 'BURDEN', 'BUTTON', 'CABINET', 'CAMERA', 'CAMPUS', 'CANDID', 'CANDLE',
  'CANYON', 'CARBON', 'CAREER', 'CARPET', 'CASTLE', 'CASUAL', 'CENTER', 'CHANCE',
  'CHANGE', 'CHAPTER', 'CHARGE', 'CHOICE', 'CHURCH', 'CIRCLE', 'CITIZEN', 'CLASSIC',
  'CLIENT', 'CLIMATE', 'CLOSER', 'COFFEE', 'COLUMN', 'COMBAT', 'COMFORT', 'COMMON',
  'COMPASS', 'CONCEPT', 'CONCERN', 'CONDUCT', 'CONFIRM', 'CONNECT', 'CONSENT', 'CONTENT',
  'CONTEST', 'CONTROL', 'CONVERT', 'CORNER', 'COTTAGE', 'COUNCIL', 'COUNTER', 'COUNTRY',
  'COURAGE', 'CREATE', 'CREDIT', 'CRISIS', 'CRYSTAL', 'CULTURE', 'CURRENT', 'CUSTOM',
  'DAMAGE', 'DANCER', 'DANGER', 'DECADE', 'DECIDE', 'DEFAULT', 'DEFEND', 'DEGREE',
  'DELIVER', 'DEMAND', 'DEPEND', 'DEPOSIT', 'DESERT', 'DESIGN', 'DESIRE', 'DETAIL',
  'DEVICE', 'DEVOTE', 'DIALOG', 'DINNER', 'DIRECT', 'DISPLAY', 'DOCTOR', 'DOLLAR',
  'DOMAIN', 'DOUBLE', 'DRIVEN', 'DRIVER', 'DYNAMIC', 'EARNEST', 'EASTERN', 'ECONOMY',
  'EDITION', 'EFFORT', 'ELEGANT', 'ELEMENT', 'EMERALD', 'EMOTION', 'EMPIRE', 'EMPLOY',
  'ENABLE', 'ENDURE', 'ENERGY', 'ENGINE', 'ENHANCE', 'ENOUGH', 'ENSURE', 'ENTIRE',
  'ENTITY', 'EQUITY', 'ESCAPE', 'ESTATE', 'ETHICS', 'EVENING', 'EVIDENT', 'EXACTLY',
  'EXAMINE', 'EXAMPLE', 'EXCITED', 'EXECUTE', 'EXHIBIT', 'EXPENSE', 'EXPLAIN', 'EXPLORE',
  'EXPRESS', 'EXTEND', 'FABRIC', 'FACTOR', 'FAMILY', 'FAMOUS', 'FATHER', 'FEATURE',
  'FICTION', 'FIGURE', 'FILTER', 'FINGER', 'FINISH', 'FLIGHT', 'FLOWER', 'FOREST',
  'FORMAL', 'FORMAT', 'FORMER', 'FORTUNE', 'FORWARD', 'FOUNDER', 'FREEDOM', 'FRIEND',
  'FUTURE', 'GALAXY', 'GARDEN', 'GATHER', 'GENDER', 'GENERAL', 'GENTLE', 'GENUINE',
  'GLANCE', 'GLOBAL', 'GOLDEN', 'GOVERN', 'GRANITE', 'GRAVEL', 'GROWTH', 'GUITAR',
  'HARBOR', 'HARMONY', 'HEALTH', 'HEAVEN', 'HEIGHT', 'HELPFUL', 'HISTORY', 'HONEST',
  'HORIZON', 'HUNTER', 'IMPACT', 'IMPORT', 'IMPROVE', 'INCLUDE', 'INCOME', 'INDEED',
  'INDOOR', 'INFANT', 'INFORM', 'INJURY', 'INSECT', 'INSIDE', 'INSIGHT', 'INSPIRE',
  'INSTALL', 'INSTANT', 'INTEND', 'INVEST', 'ISLAND', 'JOURNAL', 'JOURNEY', 'JUSTICE',
  'KINGDOM', 'KITCHEN', 'LANTERN', 'LAUNCH', 'LAWYER', 'LEADER', 'LEAGUE', 'LEARNED',
  'LEATHER', 'LECTURE', 'LEGACY', 'LEISURE', 'LENDER', 'LENGTH', 'LESSON', 'LETTER',
  'LIBERTY', 'LIBRARY', 'LICENSE', 'LIMITED', 'LISTEN', 'LOCATE', 'LOGICAL', 'LOYALTY',
  'MACHINE', 'MANAGER', 'MANNER', 'MARBLE', 'MARGIN', 'MARINE', 'MARKET', 'MASTER',
  'MATTER', 'MATURE', 'MEADOW', 'MEASURE', 'MEDICAL', 'MEDIUM', 'MEMBER', 'MEMORY',
  'MENTAL', 'MENTOR', 'MERCURY', 'METHOD', 'MIDDLE', 'MINERAL', 'MINIMAL', 'MIRACLE',
  'MISSION', 'MISTAKE', 'MIXTURE', 'MOBILE', 'MODERN', 'MODEST', 'MODULE', 'MOMENT',
  'MONITOR', 'MORNING', 'MOTHER', 'MOTION', 'MOUNTAIN', 'MUSEUM', 'MUSICAL', 'MYSTERY',
  'NARROW', 'NATION', 'NATIVE', 'NATURE', 'NEARBY', 'NEATLY', 'NETWORK', 'NEUTRAL',
  'NORMAL', 'NOTICE', 'NOTION', 'NOVELTY', 'NUMBER', 'OBJECT', 'OBTAIN', 'OFFICE',
  'OPTION', 'ORACLE', 'ORANGE', 'ORCHARD', 'ORDERLY', 'ORGANIC', 'ORIGIN', 'OUTCOME',
  'OUTDOOR', 'OUTLINE', 'OUTPUT', 'OXYGEN', 'PACKAGE', 'PALACE', 'PARENT', 'PARTNER',
  'PASSAGE', 'PASSION', 'PATIENT', 'PATTERN', 'PAYMENT', 'PENALTY', 'PEOPLE', 'PEPPER',
  'PERFECT', 'PERFORM', 'PERIOD', 'PERMIT', 'PERSON', 'PHRASE', 'PICTURE', 'PIONEER',
  'PLANET', 'PLASTIC', 'PLAYER', 'PLEASE', 'POCKET', 'POETRY', 'POLICY', 'PORTAL',
  'POSTER', 'POTTERY', 'POVERTY', 'PRACTICE', 'PRAISE', 'PRAYER', 'PREDICT', 'PREFER',
  'PREMIER', 'PREPARE', 'PRESENT', 'PREVENT', 'PRIMARY', 'PRINTER', 'PRIVACY', 'PRIVATE',
  'PROBLEM', 'PROCEED', 'PROCESS', 'PRODUCE', 'PRODUCT', 'PROFILE', 'PROGRAM', 'PROJECT',
  'PROMISE', 'PROMOTE', 'PROTECT', 'PROTEIN', 'PROTEST', 'PROVIDE', 'PUBLIC', 'PURPOSE',
  'PUZZLE', 'QUALITY', 'QUARTER', 'QUIETLY', 'RADIANT', 'RAILWAY', 'RANDOM', 'RANGER',
  'READER', 'REALITY', 'REALIZE', 'REASON', 'RECEIVE', 'RECENT', 'RECORD', 'RECOVER',
  'REDUCE', 'REFLECT', 'REFORM', 'REFUGE', 'REGARD', 'REGION', 'REGULAR', 'RELATE',
  'RELEASE', 'REMAIN', 'REMARK', 'REMEDY', 'REMIND', 'REMOTE', 'REMOVE', 'REPAIR',
  'REPEAT', 'REPLACE', 'REPORT', 'REQUEST', 'REQUIRE', 'RESCUE', 'RESERVE', 'RESOLVE',
  'RESORT', 'RESPECT', 'RESPOND', 'RESTORE', 'RESULT', 'RETAIL', 'RETAIN', 'RETIRE',
  'RETURN', 'REVEAL', 'REVIEW', 'REWARD', 'RHYTHM', 'RIBBON', 'RIDDLE', 'ROBUST',
  'ROUTINE', 'SAILOR', 'SALARY', 'SAMPLE', 'SAVING', 'SCHEME', 'SCHOOL', 'SCIENCE',
  'SCREEN', 'SEARCH', 'SEASON', 'SECOND', 'SECRET', 'SECTOR', 'SECURE', 'SELECT',
  'SENIOR', 'SERIES', 'SERVER', 'SETTLE', 'SEVERE', 'SHADOW', 'SHARED', 'SHIELD',
  'SIGNAL', 'SILENT', 'SILVER', 'SIMPLE', 'SINGER', 'SINGLE', 'SISTER', 'SKETCH',
  'SMOOTH', 'SOCIAL', 'SOCKET', 'SODIUM', 'SOFTLY', 'SOLVER', 'SOURCE', 'SPEAKER',
  'SPECIAL', 'SPECIES', 'SPEECH', 'SPHERE', 'SPIRIT', 'SPRING', 'SQUARE', 'STABLE',
  'STATION', 'STATUE', 'STATUS', 'STEADY', 'STORAGE', 'STRANGE', 'STREAM', 'STREET',
  'STRESS', 'STRICT', 'STRIKE', 'STRING', 'STRONG', 'STUDIO', 'SUBMIT', 'SUBTLE',
  'SUCCEED', 'SUCCESS', 'SUDDEN', 'SUMMER', 'SUMMIT', 'SUNSET', 'SUPPLY', 'SUPPORT',
  'SUPPOSE', 'SURFACE', 'SURVEY', 'SWITCH', 'SYMBOL', 'SYSTEM', 'TABLET', 'TACKLE',
  'TALENT', 'TARGET', 'TEMPLE', 'TENANT', 'TENDER', 'TENNIS', 'THANKS', 'THEORY',
  'THIRST', 'THREAD', 'THRIVE', 'THROAT', 'TICKET', 'TIMBER', 'TIMING', 'TISSUE',
  'TOWARD', 'TRACKS', 'TRADER', 'TRAVEL', 'TREATY', 'TRIPLE', 'TROPHY', 'TUNNEL',
  'TWELVE', 'UNIQUE', 'UNITED', 'UNLESS', 'UPDATE', 'UPWARD', 'URGENT', 'USEFUL',
  'VALLEY', 'VARIETY', 'VECTOR', 'VELVET', 'VENDOR', 'VESSEL', 'VICTOR', 'VIEWER',
  'VIRTUE', 'VISION', 'VISUAL', 'VOLUME', 'WANDER', 'WARMTH', 'WEALTH', 'WEAPON',
  'WEATHER', 'WEEKLY', 'WEIGHT', 'WELCOME', 'WESTERN', 'WINDOW', 'WINNER', 'WINTER',
  'WISDOM', 'WITNESS', 'WONDER', 'WORKER', 'WRITER', 'YELLOW'
];

const SORTED_SIGNATURE_MAP: Map<string, Set<string>> = (() => {
  const m = new Map<string, Set<string>>();
  for (const w of ADULT_WORD_BANK) {
    const sig = w.split('').sort().join('');
    const set = m.get(sig) ?? new Set<string>();
    set.add(w);
    m.set(sig, set);
  }
  return m;
})();

function scrambleWord(word: string): string {
  const letters = word.split('');
  for (let i = 0; i < 12; i += 1) {
    const candidate = shuffleArray(letters).join('');
    if (candidate !== word) return candidate;
  }
  return letters.reverse().join('');
}

function AnagramsGame({
  soundEnabled,
  onComplete
}: {
  soundEnabled: boolean;
  onComplete: (metrics: SessionMetrics) => void;
}) {
  const [wordQueue] = useState<string[]>(() => shuffleArray(ADULT_WORD_BANK));
  const [wordIdx, setWordIdx] = useState(0);
  const currentWord = wordQueue[wordIdx % wordQueue.length];

  const [tiles, setTiles] = useState<string[]>(() => scrambleWord(currentWord).split(''));
  const [usedTileIndices, setUsedTileIndices] = useState<number[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [points, setPoints] = useState(0);
  const [solved, setSolved] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [streak, setStreak] = useState(0);
  const [feedback, setFeedback] = useState('');

  const pointsRef = useRef(0);
  const solvedRef = useRef(0);
  const skippedRef = useRef(0);
  const solveRtsRef = useRef<number[]>([]);
  const wordStartRef = useRef<number>(performance.now());
  const doneRef = useRef(false);

  const loadWordAt = useCallback(
    (nextIndex: number) => {
      const nextWord = wordQueue[nextIndex % wordQueue.length];
      setWordIdx(nextIndex);
      setTiles(scrambleWord(nextWord).split(''));
      setUsedTileIndices([]);
      wordStartRef.current = performance.now();
    },
    [wordQueue]
  );

  useEffect(() => {
    const id = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(id);
          if (!doneRef.current) {
            doneRef.current = true;
            const attempted = solvedRef.current + skippedRef.current;
            const accuracyPercent =
              attempted === 0
                ? 0
                : Math.round((solvedRef.current / attempted) * 100);
            const avgRt = mean(solveRtsRef.current);
            playCue(soundEnabled, 'done');
            onComplete({
              gameId: 'anagrams-fluency',
              domain: 'Verbal Fluency & Lexical Retrieval',
              score: pointsRef.current,
              accuracyPercent,
              avgReactionTimeMs: avgRt,
              durationSeconds: 60
            });
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [onComplete, soundEnabled]);

  const guessWord = usedTileIndices.map((idx) => tiles[idx]).join('');

  const checkAttempt = useCallback(
    (candidate: string) => {
      if (candidate.length !== currentWord.length) return;
      const sig = currentWord.split('').sort().join('');
      const validSet = SORTED_SIGNATURE_MAP.get(sig);
      const isMatch = candidate === currentWord || Boolean(validSet?.has(candidate));

      if (isMatch) {
        const rt = Math.round(performance.now() - wordStartRef.current);
        solveRtsRef.current.push(rt);
        const nextStreak = streak + 1;
        const gained = 100 + (nextStreak - 1) * 25;
        pointsRef.current += gained;
        solvedRef.current += 1;

        setPoints(pointsRef.current);
        setSolved(solvedRef.current);
        setStreak(nextStreak);
        setFeedback(`+${gained} pts${nextStreak > 1 ? ` (${nextStreak}× streak)` : ''}`);
        playCue(soundEnabled, 'good');

        window.setTimeout(() => {
          setFeedback('');
          loadWordAt(wordIdx + 1);
        }, 380);
      } else {
        playCue(soundEnabled, 'bad');
        setFeedback('Not a match — rearrange and try again.');
        window.setTimeout(() => setFeedback(''), 800);
      }
    },
    [currentWord, streak, wordIdx, loadWordAt, soundEnabled]
  );

  const handleTileTap = (tileIdx: number) => {
    if (usedTileIndices.includes(tileIdx) || doneRef.current) return;
    playCue(soundEnabled, 'tap');
    const nextUsed = [...usedTileIndices, tileIdx];
    setUsedTileIndices(nextUsed);
    if (nextUsed.length === currentWord.length) {
      checkAttempt(nextUsed.map((i) => tiles[i]).join(''));
    }
  };

  const handleRemoveAnswerAt = (slotPos: number) => {
    if (slotPos >= usedTileIndices.length || doneRef.current) return;
    setUsedTileIndices((prev) => prev.filter((_, i) => i !== slotPos));
  };

  const handleShuffle = useCallback(() => {
    if (doneRef.current) return;
    playCue(soundEnabled, 'tap');
    setUsedTileIndices([]);
    setTiles((prev) => shuffleArray(prev));
  }, [soundEnabled]);

  const handleSkip = () => {
    if (doneRef.current) return;
    playCue(soundEnabled, 'bad');
    skippedRef.current += 1;
    setSkipped(skippedRef.current);
    setStreak(0);
    setFeedback(`Skipped (${currentWord})`);
    window.setTimeout(() => {
      setFeedback('');
      loadWordAt(wordIdx + 1);
    }, 550);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (doneRef.current) return;
      if (e.key === 'Backspace') {
        setUsedTileIndices((prev) => prev.slice(0, -1));
      } else if (e.key === ' ') {
        e.preventDefault();
        handleShuffle();
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        const upper = e.key.toUpperCase();
        const availableIdx = tiles.findIndex(
          (ch, idx) => ch === upper && !usedTileIndices.includes(idx)
        );
        if (availableIdx !== -1) {
          const nextUsed = [...usedTileIndices, availableIdx];
          setUsedTileIndices(nextUsed);
          if (nextUsed.length === currentWord.length) {
            checkAttempt(nextUsed.map((i) => tiles[i]).join(''));
          }
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [tiles, usedTileIndices, currentWord.length, checkAttempt, handleShuffle]);

  return (
    <div className="acgm-stage">
      <div className="acgm-hud-row">
        <div className="acgm-metric">
          <span>Time Left</span>
          <strong className="acgm-num">{secondsLeft}s</strong>
        </div>
        <div className="acgm-metric">
          <span>Score</span>
          <strong className="acgm-num">{points}</strong>
        </div>
        <div className="acgm-metric">
          <span>Streak</span>
          <strong className="acgm-num">{streak}×</strong>
        </div>
        <div className="acgm-metric">
          <span>Solved</span>
          <strong className="acgm-num">{solved}</strong>
        </div>
      </div>

      <div className="acgm-anagram-workspace">
        <div className="acgm-answer-slots" aria-label="Answer letter slots">
          {Array.from({ length: currentWord.length }, (_, slotIdx) => {
            const letter = guessWord[slotIdx] || '';
            return (
              <button
                key={slotIdx}
                type="button"
                onClick={() => handleRemoveAnswerAt(slotIdx)}
                disabled={!letter}
                className={`acgm-slot-box ${letter ? 'is-filled' : ''}`}
                aria-label={letter ? `Remove letter ${letter}` : `Empty slot ${slotIdx + 1}`}
              >
                {letter}
              </button>
            );
          })}
        </div>

        <div className="acgm-letter-pool" aria-label="Scrambled letter tiles">
          {tiles.map((letter, idx) => {
            const used = usedTileIndices.includes(idx);
            return (
              <button
                key={`${idx}-${letter}`}
                type="button"
                disabled={used}
                onClick={() => handleTileTap(idx)}
                className={`acgm-letter-tile ${used ? 'is-used' : ''}`}
              >
                {letter}
              </button>
            );
          })}
        </div>

        <div className="acgm-anagram-actions">
          <button type="button" onClick={handleShuffle} className="acgm-secondary-btn">
            Shuffle Letters
          </button>
          <button
            type="button"
            onClick={() => setUsedTileIndices([])}
            className="acgm-secondary-btn"
          >
            Clear
          </button>
          <button type="button" onClick={handleSkip} className="acgm-secondary-btn">
            Skip Word
          </button>
        </div>

        {feedback && (
          <p className="acgm-feedback-line" role="status">
            {feedback}
          </p>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Plug-and-Play Module Shell                                                 */
/* -------------------------------------------------------------------------- */

export const AdvancedCognitiveGamesModule: React.FC<AdvancedCognitiveGamesModuleProps> = ({
  onSessionComplete,
  initialGameId,
  soundEnabled = true,
  highContrast = false,
  onExitModule
}) => {
  const [activeGameId, setActiveGameId] = useState<AdvancedGameId | null>(initialGameId ?? null);
  const [sessionSeed, setSessionSeed] = useState(0);
  const [summary, setSummary] = useState<SessionMetrics | null>(null);

  const activeMeta = useMemo(
    () => GAME_CATALOG.find((g) => g.id === activeGameId) ?? null,
    [activeGameId]
  );

  const handleComplete = useCallback(
    (metrics: SessionMetrics) => {
      setSummary(metrics);
      onSessionComplete(metrics);
    },
    [onSessionComplete]
  );

  const startExercise = (id: AdvancedGameId) => {
    setSummary(null);
    setActiveGameId(id);
    setSessionSeed((s) => s + 1);
  };

  return (
    <section
      className={`acgm-root ${highContrast ? 'acgm-high-contrast' : ''}`}
      aria-label="Advanced Cognitive Exercises Module"
    >
      <style>{MODULE_STYLES}</style>

      {!activeMeta ? (
        <div className="acgm-menu">
          <div className="acgm-menu-header">
            <div>
              <p className="acgm-kicker">Cognitive Exercise Suite</p>
              <h2 className="acgm-title">Select an Assessment or Practice Module</h2>
            </div>
            {onExitModule && (
              <button type="button" onClick={onExitModule} className="acgm-ghost-btn">
                Return to Overview
              </button>
            )}
          </div>

          <div className="acgm-catalog-grid">
            {GAME_CATALOG.map((item) => (
              <article key={item.id} className="acgm-catalog-card">
                <div className="acgm-card-top">
                  <span className="acgm-index">{item.indexLabel}</span>
                  <span className="acgm-meta-text">
                    {item.domain} · {item.durationHint}
                  </span>
                </div>
                <h3 className="acgm-card-title">{item.title}</h3>
                <p className="acgm-card-desc">{item.instruction}</p>
                <button
                  type="button"
                  onClick={() => startExercise(item.id)}
                  className="acgm-primary-btn acgm-card-btn"
                >
                  Start Exercise
                </button>
              </article>
            ))}
          </div>
        </div>
      ) : (
        <div className="acgm-runner">
          <div className="acgm-runner-header">
            <button
              type="button"
              onClick={() => {
                setSummary(null);
                setActiveGameId(null);
              }}
              className="acgm-ghost-btn"
            >
              ← All Exercises
            </button>
            <div className="acgm-runner-titles">
              <span className="acgm-meta-text">{activeMeta.domain}</span>
              <h2 className="acgm-runner-title">{activeMeta.title}</h2>
            </div>
          </div>

          <p className="acgm-instruction-banner">{activeMeta.instruction}</p>

          {summary ? (
            <div className="acgm-summary" role="region" aria-label="Session summary">
              <p className="acgm-kicker">Session Complete</p>
              <h3 className="acgm-summary-heading">{activeMeta.title}</h3>
              <div className="acgm-summary-grid">
                <div className="acgm-summary-stat">
                  <span>Score</span>
                  <strong className="acgm-num">{summary.score}</strong>
                </div>
                <div className="acgm-summary-stat">
                  <span>Accuracy</span>
                  <strong className="acgm-num">{summary.accuracyPercent}%</strong>
                </div>
                <div className="acgm-summary-stat">
                  <span>Avg Reaction</span>
                  <strong className="acgm-num">{summary.avgReactionTimeMs} ms</strong>
                </div>
                <div className="acgm-summary-stat">
                  <span>Duration</span>
                  <strong className="acgm-num">{summary.durationSeconds} s</strong>
                </div>
              </div>
              <div className="acgm-summary-actions">
                <button
                  type="button"
                  onClick={() => startExercise(activeMeta.id)}
                  className="acgm-primary-btn"
                >
                  Play Again
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSummary(null);
                    setActiveGameId(null);
                  }}
                  className="acgm-secondary-btn"
                >
                  Choose Another Exercise
                </button>
              </div>
            </div>
          ) : (
            <React.Fragment key={`${activeMeta.id}-${sessionSeed}`}>
              {activeMeta.id === 'mental-rotation' && (
                <MentalRotationGame soundEnabled={soundEnabled} onComplete={handleComplete} />
              )}
              {activeMeta.id === 'trail-making-ab' && (
                <TrailMakingGame soundEnabled={soundEnabled} onComplete={handleComplete} />
              )}
              {activeMeta.id === 'corsi-span' && (
                <CorsiSpanGame soundEnabled={soundEnabled} onComplete={handleComplete} />
              )}
              {activeMeta.id === 'calcudoku-4x4' && (
                <CalcudokuGame soundEnabled={soundEnabled} onComplete={handleComplete} />
              )}
              {activeMeta.id === 'rvip-vigilance' && (
                <RvipGame soundEnabled={soundEnabled} onComplete={handleComplete} />
              )}
              {activeMeta.id === 'anagrams-fluency' && (
                <AnagramsGame soundEnabled={soundEnabled} onComplete={handleComplete} />
              )}
            </React.Fragment>
          )}
        </div>
      )}
    </section>
  );
};

/* -------------------------------------------------------------------------- */
/* Self-Contained Minimalist High-Contrast Adult Styles                       */
/* -------------------------------------------------------------------------- */

const MODULE_STYLES = `
.acgm-root {
  --acgm-bg: #f7f9f8;
  --acgm-surface: #ffffff;
  --acgm-surface-alt: #eef2f0;
  --acgm-ink: #11241f;
  --acgm-muted: #4a6159;
  --acgm-border: #c5d2cd;
  --acgm-border-soft: #dce5e1;
  --acgm-accent: #145343;
  --acgm-accent-hover: #0e3e32;
  --acgm-accent-ink: #ffffff;
  --acgm-ok: #155e43;
  --acgm-ok-bg: #e3f2eb;
  --acgm-err: #9c2018;
  --acgm-err-bg: #fdeceb;
  --acgm-warn: #9a5a00;
  color: var(--acgm-ink);
  font-family: "Plus Jakarta Sans", system-ui, -apple-system, sans-serif;
  width: 100%;
  box-sizing: border-box;
}
.acgm-root.acgm-high-contrast {
  --acgm-bg: #ffffff;
  --acgm-surface: #ffffff;
  --acgm-surface-alt: #f0f0f0;
  --acgm-ink: #000000;
  --acgm-muted: #1f1f1f;
  --acgm-border: #000000;
  --acgm-border-soft: #444444;
  --acgm-accent: #000000;
  --acgm-accent-hover: #222222;
  --acgm-accent-ink: #ffffff;
}
.acgm-root *, .acgm-root *::before, .acgm-root *::after {
  box-sizing: border-box;
}
.acgm-num {
  font-variant-numeric: tabular-nums;
}
.acgm-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}
.acgm-menu-header, .acgm-runner-header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.25rem;
}
.acgm-kicker {
  margin: 0 0 0.25rem 0;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--acgm-accent);
}
.acgm-title, .acgm-runner-title {
  margin: 0;
  font-size: clamp(1.35rem, 2.5vw, 1.85rem);
  line-height: 1.2;
  color: var(--acgm-ink);
}
.acgm-meta-text {
  font-size: 0.85rem;
  color: var(--acgm-muted);
  font-weight: 600;
}
.acgm-catalog-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}
@media (max-width: 980px) {
  .acgm-catalog-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 640px) {
  .acgm-catalog-grid { grid-template-columns: 1fr; }
}
.acgm-catalog-card {
  display: flex;
  flex-direction: column;
  background: var(--acgm-surface);
  border: 1px solid var(--acgm-border);
  border-radius: 14px;
  padding: 1.25rem;
  gap: 0.65rem;
}
.acgm-card-top {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
}
.acgm-index {
  font-variant-numeric: tabular-nums;
  font-weight: 800;
  font-size: 0.9rem;
  color: var(--acgm-accent);
}
.acgm-card-title {
  margin: 0;
  font-size: 1.15rem;
  color: var(--acgm-ink);
}
.acgm-card-desc {
  margin: 0;
  font-size: 0.92rem;
  line-height: 1.45;
  color: var(--acgm-muted);
  flex: 1;
}
.acgm-primary-btn, .acgm-secondary-btn, .acgm-ghost-btn {
  min-height: 46px;
  padding: 0.65rem 1.15rem;
  border-radius: 10px;
  font-weight: 700;
  font-size: 0.95rem;
  cursor: pointer;
  white-space: nowrap;
  transition: transform 0.14s ease, background-color 0.14s ease;
}
.acgm-primary-btn {
  background: var(--acgm-accent);
  color: var(--acgm-accent-ink);
  border: 2px solid var(--acgm-accent);
}
.acgm-primary-btn:hover { background: var(--acgm-accent-hover); }
.acgm-primary-btn:active { transform: scale(0.98); }
.acgm-card-btn { margin-top: 0.35rem; align-self: flex-start; }
.acgm-secondary-btn {
  background: var(--acgm-surface);
  color: var(--acgm-ink);
  border: 2px solid var(--acgm-border);
}
.acgm-secondary-btn:hover { background: var(--acgm-surface-alt); }
.acgm-ghost-btn {
  background: transparent;
  color: var(--acgm-accent);
  border: 1px solid var(--acgm-border);
}
.acgm-ghost-btn:hover { background: var(--acgm-surface-alt); }
.acgm-runner {
  background: var(--acgm-surface);
  border: 1px solid var(--acgm-border);
  border-radius: 16px;
  padding: clamp(1rem, 3vw, 1.75rem);
}
.acgm-runner-titles {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  text-align: right;
}
@media (max-width: 600px) {
  .acgm-runner-titles { align-items: flex-start; text-align: left; }
}
.acgm-instruction-banner {
  margin: 0 0 1.25rem 0;
  padding: 0.75rem 1rem;
  background: var(--acgm-surface-alt);
  border: 1px solid var(--acgm-border-soft);
  border-radius: 10px;
  font-size: 0.98rem;
  font-weight: 600;
  color: var(--acgm-ink);
}
.acgm-stage {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}
.acgm-hud-row {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem 2rem;
  padding-bottom: 0.85rem;
  border-bottom: 1px solid var(--acgm-border-soft);
}
.acgm-metric {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}
.acgm-metric span {
  font-size: 0.78rem;
  color: var(--acgm-muted);
  font-weight: 600;
}
.acgm-metric strong {
  font-size: 1.15rem;
  color: var(--acgm-ink);
}
.acgm-accent-ok { color: var(--acgm-ok) !important; }
.acgm-accent-warn { color: var(--acgm-warn) !important; }
.acgm-inline-alert {
  margin: 0;
  padding: 0.65rem 0.9rem;
  background: var(--acgm-err-bg);
  color: var(--acgm-err);
  border: 1px solid var(--acgm-err);
  border-radius: 8px;
  font-weight: 700;
  font-size: 0.92rem;
}

/* Game 1: Mental Rotation */
.acgm-mr-layout {
  display: grid;
  grid-template-columns: minmax(200px, 280px) 1fr;
  gap: 1.5rem;
  align-items: center;
}
@media (max-width: 780px) {
  .acgm-mr-layout { grid-template-columns: 1fr; }
}
.acgm-mr-target-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 1.25rem;
  background: var(--acgm-surface-alt);
  border: 2px solid var(--acgm-ink);
  border-radius: 14px;
}
.acgm-sublabel {
  margin: 0;
  font-weight: 700;
  font-size: 0.9rem;
  color: var(--acgm-ink);
}
.acgm-mr-candidates {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.9rem;
}
.acgm-mr-option {
  position: relative;
  display: grid;
  place-items: center;
  padding: 1rem;
  min-height: 150px;
  background: var(--acgm-surface);
  border: 2px solid var(--acgm-border);
  border-radius: 14px;
  cursor: pointer;
  transition: border-color 0.14s ease, transform 0.14s ease;
}
.acgm-mr-option:hover:not(:disabled) {
  border-color: var(--acgm-accent);
  transform: translateY(-2px);
}
.acgm-mr-option.is-correct {
  border-color: var(--acgm-ok);
  background: var(--acgm-ok-bg);
}
.acgm-mr-option.is-wrong {
  border-color: var(--acgm-err);
  background: var(--acgm-err-bg);
}
.acgm-option-index {
  position: absolute;
  top: 0.5rem;
  left: 0.65rem;
  font-size: 0.85rem;
  font-weight: 800;
  color: var(--acgm-muted);
}
.acgm-poly-grid {
  display: grid;
  grid-template-columns: repeat(5, 22px);
  grid-template-rows: repeat(5, 22px);
  gap: 3px;
}
.acgm-poly-grid.acgm-poly-lg {
  grid-template-columns: repeat(5, 30px);
  grid-template-rows: repeat(5, 30px);
  gap: 4px;
}
.acgm-poly-cell {
  border-radius: 4px;
  background: rgba(17, 36, 31, 0.06);
  border: 1px solid rgba(17, 36, 31, 0.1);
}
.acgm-poly-cell.is-filled {
  background: #1d3c34;
  border-color: #0d1f1b;
  box-shadow: inset 2px 2px 0 rgba(255,255,255,0.22), inset -2px -2px 0 rgba(0,0,0,0.35);
}
.acgm-poly-cell.is-target {
  background: var(--acgm-accent);
  border-color: #0b2e25;
  box-shadow: inset 2px 2px 0 rgba(255,255,255,0.28), inset -2px -2px 0 rgba(0,0,0,0.35);
}

/* Game 2: Trail Making */
.acgm-trail-board {
  position: relative;
  width: 100%;
  height: clamp(320px, 52vh, 460px);
  background: var(--acgm-surface-alt);
  border: 2px solid var(--acgm-border);
  border-radius: 14px;
  overflow: hidden;
  touch-action: manipulation;
}
.acgm-trail-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.acgm-trail-line {
  stroke: var(--acgm-accent);
  stroke-width: 0.7;
  stroke-linecap: round;
}
.acgm-trail-node {
  position: absolute;
  transform: translate(-50%, -50%);
  width: 46px;
  height: 46px;
  border-radius: 50%;
  border: 2px solid var(--acgm-ink);
  background: var(--acgm-surface);
  color: var(--acgm-ink);
  font-weight: 800;
  font-size: 1.05rem;
  display: grid;
  place-items: center;
  cursor: pointer;
  z-index: 2;
  transition: transform 0.12s ease, background-color 0.12s ease;
}
.acgm-trail-node.is-done {
  background: var(--acgm-accent);
  color: var(--acgm-accent-ink);
  border-color: var(--acgm-accent);
}
.acgm-trail-node.is-error {
  background: var(--acgm-err-bg);
  color: var(--acgm-err);
  border-color: var(--acgm-err);
  transform: translate(-50%, -50%) scale(1.12);
}

/* Game 3: Corsi Block-Tapping */
.acgm-corsi-status {
  font-weight: 700;
  font-size: 1rem;
  color: var(--acgm-ink);
}
.acgm-corsi-board {
  position: relative;
  width: 100%;
  height: clamp(300px, 48vh, 420px);
  background: #13211d;
  border-radius: 14px;
  border: 2px solid var(--acgm-ink);
  touch-action: manipulation;
}
.acgm-corsi-block {
  position: absolute;
  transform: translate(-50%, -50%);
  width: clamp(50px, 11vw, 68px);
  height: clamp(50px, 11vw, 68px);
  border-radius: 10px;
  background: #2b443d;
  border: 2px solid #597c72;
  cursor: pointer;
  transition: background-color 0.12s ease, transform 0.12s ease;
}
.acgm-corsi-block:disabled { cursor: default; }
.acgm-corsi-block.is-lit {
  background: #f5b935;
  border-color: #ffffff;
  transform: translate(-50%, -50%) scale(1.08);
}
.acgm-corsi-block.is-tapped {
  background: #469d83;
  border-color: #e6f5ef;
}
.acgm-corsi-block.is-error {
  background: #d6453a;
  border-color: #ffffff;
}

/* Game 4: Calcudoku */
.acgm-calc-layout {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  align-items: flex-start;
}
.acgm-calc-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(64px, 84px));
  grid-template-rows: repeat(4, minmax(64px, 84px));
  border: 2px solid var(--acgm-ink);
  background: var(--acgm-surface);
}
.acgm-calc-cell {
  position: relative;
  display: grid;
  place-items: center;
  background: var(--acgm-surface);
  color: var(--acgm-ink);
  border-style: solid;
  padding: 0;
  cursor: pointer;
}
.acgm-calc-cell.is-selected {
  background: #e2efe9;
  outline: 3px solid var(--acgm-accent);
  outline-offset: -3px;
  z-index: 2;
}
.acgm-calc-cell.is-error {
  background: var(--acgm-err-bg);
}
.acgm-cage-clue {
  position: absolute;
  top: 4px;
  left: 5px;
  font-size: 0.72rem;
  font-weight: 800;
  line-height: 1;
  color: var(--acgm-ink);
  font-variant-numeric: tabular-nums;
}
.acgm-calc-val {
  font-size: 1.6rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.acgm-calc-controls {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  min-width: 220px;
}
.acgm-keypad {
  display: grid;
  grid-template-columns: repeat(2, minmax(64px, 1fr));
  gap: 0.55rem;
}
.acgm-key-btn {
  min-height: 50px;
  border: 2px solid var(--acgm-border);
  border-radius: 10px;
  background: var(--acgm-surface-alt);
  color: var(--acgm-ink);
  font-weight: 800;
  font-size: 1.15rem;
  cursor: pointer;
}
.acgm-key-btn:hover { border-color: var(--acgm-accent); }
.acgm-key-clear { grid-column: span 2; font-size: 0.95rem; }

/* Game 5: RVIP */
.acgm-rvip-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  padding: 1.5rem 1rem;
}
.acgm-rvip-digit {
  width: 140px;
  height: 140px;
  display: grid;
  place-items: center;
  border-radius: 18px;
  border: 3px solid var(--acgm-ink);
  background: var(--acgm-surface-alt);
  font-size: 4.5rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: var(--acgm-ink);
  animation: acgm-digit-pop 0.16s ease-out;
}
@keyframes acgm-digit-pop {
  from { transform: scale(0.9); opacity: 0.45; }
  to { transform: scale(1); opacity: 1; }
}
.acgm-rvip-digit.is-hit {
  background: var(--acgm-ok-bg);
  border-color: var(--acgm-ok);
  color: var(--acgm-ok);
}
.acgm-rvip-digit.is-false {
  background: var(--acgm-err-bg);
  border-color: var(--acgm-err);
  color: var(--acgm-err);
}
.acgm-rvip-btn {
  min-height: 58px;
  min-width: min(100%, 300px);
  padding: 0.85rem 1.75rem;
  border-radius: 12px;
  border: 2px solid var(--acgm-accent);
  background: var(--acgm-accent);
  color: var(--acgm-accent-ink);
  font-size: 1.1rem;
  font-weight: 800;
  cursor: pointer;
}
.acgm-rvip-btn:active { transform: scale(0.98); }
.acgm-muted-note {
  margin: 0;
  font-size: 0.9rem;
  color: var(--acgm-muted);
  text-align: center;
}

/* Game 6: Anagrams */
.acgm-anagram-workspace {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  padding: 1rem 0;
}
.acgm-answer-slots, .acgm-letter-pool {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.55rem;
}
.acgm-slot-box, .acgm-letter-tile {
  width: 48px;
  height: 54px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  font-size: 1.35rem;
  font-weight: 800;
  cursor: pointer;
}
.acgm-slot-box {
  border: 2px dashed var(--acgm-border);
  background: var(--acgm-surface-alt);
  color: var(--acgm-ink);
}
.acgm-slot-box.is-filled {
  border-style: solid;
  border-color: var(--acgm-accent);
  background: var(--acgm-surface);
}
.acgm-letter-tile {
  border: 2px solid var(--acgm-ink);
  background: var(--acgm-surface);
  color: var(--acgm-ink);
}
.acgm-letter-tile.is-used {
  opacity: 0.25;
  cursor: default;
}
.acgm-anagram-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.65rem;
}
.acgm-feedback-line {
  margin: 0;
  font-weight: 700;
  color: var(--acgm-accent);
}

/* Summary */
.acgm-summary {
  padding: 1.25rem;
  background: var(--acgm-surface-alt);
  border: 1px solid var(--acgm-border);
  border-radius: 14px;
}
.acgm-summary-heading {
  margin: 0 0 1rem 0;
  font-size: 1.35rem;
}
.acgm-summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.85rem;
  margin-bottom: 1.25rem;
}
@media (max-width: 640px) {
  .acgm-summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
.acgm-summary-stat {
  background: var(--acgm-surface);
  border: 1px solid var(--acgm-border-soft);
  border-radius: 10px;
  padding: 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.acgm-summary-stat span {
  font-size: 0.8rem;
  color: var(--acgm-muted);
  font-weight: 600;
}
.acgm-summary-stat strong {
  font-size: 1.4rem;
  color: var(--acgm-ink);
}
.acgm-summary-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}
`;

export default AdvancedCognitiveGamesModule;
