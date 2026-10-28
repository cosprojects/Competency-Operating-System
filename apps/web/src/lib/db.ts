import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { axionaPrisma?: PrismaClient };

export function getDb(): PrismaClient {
  if (!globalForPrisma.axionaPrisma) {
    globalForPrisma.axionaPrisma = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    });
  }
  return globalForPrisma.axionaPrisma;
}
