/** `npm run release:publications` — список опубликованных релизов и текущий указатель. */
import process from "node:process";
import { FsPublicationStore } from "../../src/methodology/v1/release/publication.ts";

async function main(): Promise<void> {
  const store = new FsPublicationStore(process.cwd());
  const current = await store.readCurrent();
  const all = await store.list();

  if (current) {
    console.log(`текущая публикация: ${current.releaseId} · ${current.snapshotHash.slice(0, 12)} · ${current.publishedAt}`);
    if (current.promotedAt) console.log(`  промоушен: ${current.promotedAt}`);
  } else {
    console.log("публикаций нет");
  }

  if (all.length > 0) {
    console.log("\nвсе публикации:");
    for (const item of all) {
      const promoted = item.promotedAt ? `promoted ${item.promotedAt}` : "не промоушена";
      console.log(`  ${item.releaseId.padEnd(24)} ${item.snapshotHash.slice(0, 12)}  ${item.publishedAt}  ${promoted}`);
    }
  }
}

main().catch((error: unknown) => {
  console.error(`ошибка: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
