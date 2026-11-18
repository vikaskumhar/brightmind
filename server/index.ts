import 'dotenv/config';
import { join } from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { z } from 'zod';
import { store } from './store';
import type { PublicUser } from './types';

const app = express();
const port = Number(process.env.PORT ?? 3000);
const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? 'development-secret-change-before-production');
app.use(cors()); app.use(express.json());
const publicUser = (user: PublicUser): PublicUser => { const { passwordHash: _passwordHash, ...safe } = user as PublicUser & { passwordHash?: string }; return safe; };
const createToken = (id: string) => new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject(id).setIssuedAt().setExpirationTime('7d').sign(secret);
const registration = z.object({ name: z.string().trim().min(2).max(60), email: z.string().trim().email(), password: z.string().min(8).max(128), ageRange: z.string().min(1).max(30) });
const login = registration.pick({ email: true, password: true });

interface AuthedRequest extends Request { userId?: string; }
const asyncRoute = (handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => { void handler(req, res, next).catch(next); };
async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  try { const raw = req.headers.authorization?.replace('Bearer ', ''); if (!raw) throw new Error(); const { payload } = await jwtVerify(raw, secret); if (!payload.sub) throw new Error(); req.userId = payload.sub; next(); }
  catch { res.status(401).json({ message: 'Please sign in to continue.' }); }
}
app.post('/api/auth/register', asyncRoute(async (req, res) => {
  const parsed = registration.safeParse(req.body); if (!parsed.success) return res.status(400).json({ message: 'Please check your details and try again.' });
  if (await store.findByEmail(parsed.data.email)) return res.status(409).json({ message: 'An account with this email already exists.' });
  const passwordHash = await bcrypt.hash(parsed.data.password, 12); const user = await store.create({ ...parsed.data, passwordHash });
  res.status(201).json({ token: await createToken(user.id), user: publicUser(user) });
}));
app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const parsed = login.safeParse(req.body); if (!parsed.success) return res.status(400).json({ message: 'Enter your email and password.' });
  const user = await store.findByEmail(parsed.data.email); if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) return res.status(401).json({ message: 'That email or password did not match. Please try again.' });
  res.json({ token: await createToken(user.id), user: publicUser(user) });
}));
app.get('/api/me', requireAuth, asyncRoute(async (req: AuthedRequest, res) => { const user = await store.findById((req as AuthedRequest).userId!); if (!user) return res.status(404).json({ message: 'We could not find your account.' }); res.json({ user: publicUser(user) }); }));
app.patch('/api/preferences', requireAuth, asyncRoute(async (req: AuthedRequest, res) => {
  const parsed = z.object({ textSize: z.enum(['large', 'extra-large']).optional(), highContrast: z.boolean().optional(), soundEnabled: z.boolean().optional(), reducedMotion: z.boolean().optional(), language: z.enum(['en', 'hi']).optional(), difficulty: z.enum(['easy', 'medium', 'hard']).optional(), reminderTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Those settings could not be saved. Please try again.' }); const user = await store.updatePreferences(req.userId!, parsed.data); res.json({ user: publicUser(user!) });
}));
app.get('/api/dashboard', requireAuth, asyncRoute(async (req: AuthedRequest, res) => {
  const results = await store.resultsForUser(req.userId!); const today = new Date().toISOString().slice(0, 10);
  const completedToday = new Set(results.filter((result) => result.playedAt.slice(0, 10) === today).map((result) => result.game)).size;
  const days = [...new Set(results.map((result) => result.playedAt.slice(0, 10)))].sort().reverse(); let streak = 0; const cursor = new Date(); cursor.setHours(0, 0, 0, 0);
  for (const day of days) { if (day !== cursor.toISOString().slice(0, 10)) break; streak += 1; cursor.setDate(cursor.getDate() - 1); }
  res.json({ completedToday, totalGames: results.length, streak, recent: results.slice(0, 5) });
}));
app.post('/api/game-results', requireAuth, asyncRoute(async (req: AuthedRequest, res) => {
  const parsed = z.object({ game: z.enum(['memory', 'numbers', 'words']), score: z.number().int().min(0).max(100), total: z.number().int().min(1).max(100), durationSeconds: z.number().int().min(0).max(3600) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'We could not save that game result.' });
  res.status(201).json({ result: await store.addGameResult({ userId: req.userId!, ...parsed.data }) });
}));
app.use('/api', (_req, res) => res.status(404).json({ message: 'We could not find that page.' }));
const distDir = join(process.cwd(), 'dist');
app.use(express.static(distDir));
app.get('*', (_req, res) => res.sendFile(join(distDir, 'index.html')));
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => { console.error(err); res.status(500).json({ message: 'Something went wrong. Please try again.' }); });
app.listen(port, '0.0.0.0', () => console.log(`Bright Mind API running on ${port} · database: ${process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Supabase' : 'local JSON'}`));
