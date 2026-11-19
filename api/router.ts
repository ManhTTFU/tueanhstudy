/**
 * Vercel Function duy nhất cho toàn bộ REST API.
 * vercel.json rewrite: /api/<route> -> /api/router?route=<route>
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleApiRequest } from '../server/router.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { route, ...rest } = req.query;
  const routePath = Array.isArray(route) ? route.join('/') : (route ?? '');
  const query: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(rest)) query[k] = Array.isArray(v) ? v[0] : v;

  const headers: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(req.headers)) headers[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : v;

  const forwardedFor = headers['x-forwarded-for']?.split(',')[0]?.trim();
  const result = await handleApiRequest({
    method: req.method ?? 'GET',
    path: routePath,
    query,
    headers,
    body: req.body,
    ip: forwardedFor || req.socket?.remoteAddress || 'unknown',
    secure: headers['x-forwarded-proto'] !== 'http',
  });

  res.setHeader('Cache-Control', 'no-store');
  for (const [k, v] of Object.entries(result.headers ?? {})) res.setHeader(k, v);
  res.status(result.status).json(result.body ?? null);
}
