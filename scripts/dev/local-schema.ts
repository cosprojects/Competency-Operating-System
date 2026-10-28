import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const source = await readFile(path.join(root, "prisma/schema.prisma"), "utf8");
const local = source
  .replace('provider = "postgresql"', 'provider = "sqlite"')
  .replace('url      = env("DATABASE_URL")', 'url      = "file:../data/local.db"');
await mkdir(path.join(root, "data"), { recursive: true });
await writeFile(path.join(root, "prisma/schema.local.prisma"), local, "utf8");
console.log("written: prisma/schema.local.prisma (sqlite, data/local.db)");
