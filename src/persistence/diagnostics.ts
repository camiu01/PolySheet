/** @file Refresh derived compatibility diagnostics without touching imported originals. */
import { diagnose } from '../importing/system';
import { db } from './db';

/** Recheck unchanged snapshots at the write boundary; safe under repeated/offline startup. */
export async function refreshSystemDiagnostics(database = db) {
  for (const system of await database.systems.toArray()) {
    const diagnostics = diagnose(system.definition);
    if (JSON.stringify(diagnostics) === JSON.stringify(system.diagnostics)) continue;
    await database.transaction('rw', database.systems, async () => {
      const latest = await database.systems.get(system.key);
      if (!latest || latest.original !== system.original || latest.digest !== system.digest
        || JSON.stringify(latest.diagnostics) !== JSON.stringify(system.diagnostics)) return;
      await database.systems.update(system.key, { diagnostics });
    });
  }
}
