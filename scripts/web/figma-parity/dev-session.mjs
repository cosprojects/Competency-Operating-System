#!/usr/bin/env node
/**
 * Figma parity — локальная сессия для съёмки закрытых экранов.
 *
 * Пишет в data/local.db (sqlite, схема prisma/schema.local.prisma) пользователя
 * и сессию, чтобы headless Chrome мог зайти на /saved, /account, /admin/*.
 *
 * Usage: node scripts/web/figma-parity/dev-session.mjs [--email a@b.c]
 * Печатает строку cookie: axiona_session=<token>
 */
import { createHash, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const dbPath = join(repoRoot, 'data/local.db');

if (!existsSync(dbPath)) {
  console.error(`нет базы: ${dbPath} — сначала prisma generate --schema prisma/schema.local.prisma`);
  process.exit(1);
}

const emailIndex = process.argv.indexOf('--email');
const email = emailIndex !== -1 ? process.argv[emailIndex + 1] : 'designer@axiona.local';

const token = randomBytes(32).toString('base64url');
const tokenHash = createHash('sha256').update(token).digest('hex');
const userId = `usr_${randomBytes(8).toString('hex')}`;
const sessionId = `ses_${randomBytes(8).toString('hex')}`;
const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000)
  .toISOString()
  .replace('T', ' ')
  .slice(0, 19);

const sql = `
INSERT INTO "User" ("id", "email", "createdAt", "lastSeenAt")
VALUES ('${userId}', '${email.toLowerCase()}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT("email") DO UPDATE SET "lastSeenAt" = CURRENT_TIMESTAMP;

INSERT OR REPLACE INTO "Session" ("id", "userId", "tokenHash", "expiresAt", "createdAt", "lastSeenAt")
VALUES (
  '${sessionId}',
  (SELECT "id" FROM "User" WHERE "email" = '${email.toLowerCase()}'),
  '${tokenHash}',
  '${expiresAt}',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);
`;

execFileSync('sqlite3', [dbPath, sql], { stdio: 'inherit' });

console.log(`\nпользователь: ${email}`);
console.log(`cookie: axiona_session=${token}`);
console.log(`(для админки запускай next dev с ADMIN_EMAILS=${email})`);
