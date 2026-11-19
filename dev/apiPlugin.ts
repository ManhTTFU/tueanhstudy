/**
 * Vite plugin: chạy REST API ngay trong `npm run dev` (không cần Vercel CLI).
 *  - Có DATABASE_URL  => dùng PostgreSQL/Neon thật (giống production).
 *  - Không có         => dùng PGlite lưu tại .data/pglite (tiện thử nhanh).
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin, ViteDevServer } from 'vite';
import type { Database } from '../server/db.js';

const MAX_BODY = 4.5 * 1024 * 1024;

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error('Body quá lớn'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolve(undefined);
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        resolve(undefined);
      }
    });
    req.on('error', reject);
  });
}

export function devApiPlugin(): Plugin {
  let localDb: Promise<Database> | null = null;

  async function getLocalDb(server: ViteDevServer): Promise<Database | undefined> {
    if (process.env.DATABASE_URL) return undefined; // router tự dùng getDb()
    if (!localDb) {
      localDb = (async () => {
        const mod = (await server.ssrLoadModule('/dev/localDb.ts')) as typeof import('./localDb.js');
        const { db } = await mod.createPgliteDatabase(mod.LOCAL_DATA_DIR);
        server.config.logger.info('  ➜  API: dùng PGlite local tại .data/pglite (chưa có DATABASE_URL)');
        return db;
      })();
    }
    return localDb;
  }

  return {
    name: 'be-vui-hoc-toan-dev-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        if (!url.pathname.startsWith('/api/')) return next();
        try {
          const { handleApiRequest } = (await server.ssrLoadModule('/server/router.ts')) as typeof import('../server/router.js');
          const headers: Record<string, string | undefined> = {};
          for (const [k, v] of Object.entries(req.headers)) headers[k] = Array.isArray(v) ? v.join(', ') : v;
          const result = await handleApiRequest(
            {
              method: req.method ?? 'GET',
              path: url.pathname.slice('/api/'.length),
              query: Object.fromEntries(url.searchParams.entries()),
              headers,
              body: req.method === 'GET' ? undefined : await readBody(req),
              ip: req.socket.remoteAddress ?? 'local',
              secure: false,
            },
            await getLocalDb(server),
          );
          res.statusCode = result.status;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          for (const [k, v] of Object.entries(result.headers ?? {})) res.setHeader(k, v);
          res.end(JSON.stringify(result.body ?? null));
        } catch (err) {
          server.config.logger.error(String(err));
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: { code: 'internal_error', message: 'Lỗi máy chủ dev' } }));
        }
      });
    },
  };
}
