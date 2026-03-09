import { pool } from './db.js';
import crypto from 'crypto';

export function generateSessionId() {
  return crypto.randomBytes(32).toString('hex');
}

export async function createSession(userId) {
  const id = generateSessionId();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await pool.query(
    'INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)',
    [id, userId, expiresAt]
  );
  return { id, expiresAt };
}

export async function validateSession(sessionId) {
  if (!sessionId) return null;
  const r = await pool.query(
    'SELECT s.user_id, u.username FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.id = $1 AND s.expires_at > NOW()',
    [sessionId]
  );
  return r.rows[0] || null;
}

export async function deleteSession(sessionId) {
  await pool.query('DELETE FROM sessions WHERE id = $1', [sessionId]);
}
