import type { Progress } from '../services/homepage';
import { jwtDecode } from 'jwt-decode';

export function progressTokenBelongsToUser(token: string | null, userId: number): token is string {
  if (!token) return false;
  try { return String(jwtDecode<{ user_id?: number | string }>(token).user_id) === String(userId); }
  catch { return false; }
}

export function resumePosition(progress: Progress | null | undefined, episode?: number, miniseries?: number): number {
  if (!progress || progress.completed || (progress.episode ?? undefined) !== episode || (progress.miniseries ?? undefined) !== miniseries) return 0;
  return Math.max(0, progress.position_seconds);
}

export function progressSample(position: number, duration: number) {
  if (!Number.isFinite(position) || !Number.isFinite(duration) || position < 0 || duration <= 0) return null;
  return { position_seconds: Math.floor(Math.min(position, duration)), duration_seconds: Math.floor(duration) };
}
