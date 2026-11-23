// @vitest-environment node
/** @file Native stream decoding, immutable originals, backup and direct URL regressions. */
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { artifactBytes, prepareImport } from '../src/importing/package';
import { importFromUrl } from '../src/importing/url';
import { MAX_SYSTEM_BYTES, prepareSystem } from '../src/importing/system';
import { demoOriginal } from '../src/demo';
import { SheetDatabase, createCharacter, installSystem } from '../src/persistence/db';
import { exportBackup, restoreBackup, validateBackup } from '../src/persistence/backup';
import { createEvaluator } from '../src/engine/formulas';

const gzip = (value: string | Uint8Array) => Uint8Array.from(gzipSync(value));
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('observed gzip-JSON system envelope', () => {
  it('leaves existing plain JSON identities and exact BOM text unchanged', async () => {
    const original = '\ufeff' + demoOriginal;
    const imported = await prepareImport(new TextEncoder().encode(original), 'demo.json');
    expect(imported.key).toBe((await prepareSystem(original, 'demo.json')).key);
    expect(imported.original).toBe(original);
    expect(imported.artifact).toBeUndefined();
  });
  it('retains exact compressed bytes and hashes the uploaded file, not decoded JSON', async () => {
    const bytes = gzip('\ufeff' + demoOriginal);
    const imported = await prepareImport(bytes, 'demo.rpg');
    expect(imported.original).toBe('\ufeff' + demoOriginal);
    expect(artifactBytes(imported.artifact!.base64)).toEqual(bytes);
    expect(imported.digest).toBe(createHash('sha256').update(bytes).digest('hex'));
    expect(imported.key).not.toBe((await prepareSystem(imported.original, 'demo.json')).key);
  });
  it('distinguishes two gzip encodings of identical source instead of discarding an original', async () => {
    const first = gzip(demoOriginal), second = first.slice();
    second[4] ^= 1; // Gzip MTIME is outside the payload checksum.
    const a = await prepareImport(first, 'a.rpg'), b = await prepareImport(second, 'b.rpg');
    expect(a.original).toBe(b.original);
    expect(a.definition).toEqual(b.definition);
    expect(a.key).not.toBe(b.key);
  });
  it('rejects unknown binary envelopes and a JSON file merely renamed .rpg', async () => {
    await expect(prepareImport(new TextEncoder().encode(demoOriginal), 'fake.rpg')).rejects.toThrow('Formato .rpg non riconosciuto');
    await expect(prepareImport(Uint8Array.from([80, 75, 3, 4]), 'archive.rpg')).rejects.toThrow('Formato .rpg non riconosciuto');
  });
  it('rejects truncated and checksum-corrupted gzip', async () => {
    const bytes = gzip(demoOriginal), corrupt = bytes.slice();
    corrupt[corrupt.length - 8] ^= 1;
    await expect(prepareImport(bytes.slice(0, -4), 'bad.rpg')).rejects.toThrow('danneggiato');
    await expect(prepareImport(corrupt, 'bad.rpg')).rejects.toThrow('danneggiato');
  });
  it.each(['class/custom.rpg\n{}', '{"systems":[]}', '{"resources":[]}'])('rejects a resource/archive/index payload: %s', async value => {
    await expect(prepareImport(gzip(value), 'pack.rpg')).rejects.toThrow('non contiene un sistema JSON monolitico');
  });
  it('does not replace invalid UTF-8 inside a gzip file', async () => {
    await expect(prepareImport(gzip(Uint8Array.from([0xc3, 0x28])), 'invalid.rpg')).rejects.toThrow('UTF-8 valida');
  });
  it('accepts the exact 8 MiB expanded boundary and rejects one extra byte', async () => {
    const text = demoOriginal + ' '.repeat(MAX_SYSTEM_BYTES - new TextEncoder().encode(demoOriginal).length);
    expect((await prepareImport(gzip(text), 'boundary.rpg')).original).toBe(text);
    await expect(prepareImport(gzip(text + ' '), 'bomb.rpg')).rejects.toThrow('troppo grande');
    expect((await prepareImport(new TextEncoder().encode(text), 'boundary.json')).original).toBe(text);
    await expect(prepareImport(new Uint8Array(MAX_SYSTEM_BYTES + 1), 'oversized.rpg')).rejects.toThrow('troppo grande');
  });
  it('reports unsupported native decompression explicitly', async () => {
    vi.stubGlobal('DecompressionStream', undefined);
    await expect(prepareImport(gzip(demoOriginal), 'demo.rpg')).rejects.toThrow('browser non supporta gzip');
  });
  it('rejects corrupt or noncanonical stored Base64', () => {
    expect(() => artifactBytes('!!!!')).toThrow('Base64 non valido');
    expect(() => artifactBytes('Zg')).toThrow('Base64 non valido');
    expect(() => artifactBytes('A'.repeat(Math.ceil(MAX_SYSTEM_BYTES / 3) * 4 + 4))).toThrow('troppo grande');
  });
  it('round-trips original gzip bytes and characters through backup v2 and rejects tampering atomically', async () => {
    const database = new SheetDatabase(`package-${crypto.randomUUID()}`);
    try {
      const bytes = gzip(demoOriginal), imported = await prepareImport(bytes, 'demo.rpg');
      await installSystem(imported, database);
      const character = await createCharacter(imported, 'Retained character', database);
      const text = await exportBackup(database);
      expect(JSON.parse(text).version).toBe(4);
      await validateBackup(JSON.stringify({ ...JSON.parse(text), version: 2 }));
      database.close(); await database.open();
      await restoreBackup(text, database);
      expect(artifactBytes((await database.systems.get(imported.key))!.artifact!.base64)).toEqual(bytes);
      expect((await database.characters.get(character.id))?.systemKey).toBe(imported.key);
      const tampered = JSON.parse(text);
      tampered.systems[0].original += '\n';
      await expect(restoreBackup(JSON.stringify(tampered), database)).rejects.toThrow('alterato');
      expect((await database.characters.get(character.id))?.name).toBe('Retained character');
      tampered.systems[0].artifact.base64 = Buffer.from(gzip('{}')).toString('base64');
      await expect(restoreBackup(JSON.stringify(tampered), database)).rejects.toThrow();
      expect(await database.characters.count()).toBe(1);
      await expect(validateBackup(JSON.stringify({ ...JSON.parse(text), version: 1 }))).rejects.toThrow('backup v1');
    } finally { await database.delete(); }
  });
  it('continues restoring JSON-only backup v1 without changing immutable character pins', async () => {
    const database = new SheetDatabase(`legacy-package-${crypto.randomUUID()}`);
    try {
      const imported = await prepareSystem(demoOriginal, 'legacy.json');
      await installSystem(imported, database);
      const character = await createCharacter(imported, 'Legacy character', database);
      const legacy = JSON.parse(await exportBackup(database)); legacy.version = 1;
      await restoreBackup(JSON.stringify(legacy), database);
      expect((await database.characters.get(character.id))?.systemKey).toBe(imported.key);
      expect((await database.systems.get(imported.key))?.original).toBe(demoOriginal);
    } finally { await database.delete(); }
  });
});

describe('direct file URL contract', () => {
  it.each([
    'not a URL', 'http://files.example/system.json', 'https://user:password@files.example/system.json'
  ])('rejects invalid HTTPS URLs before requesting: %s', async url => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    await expect(importFromUrl(url)).rejects.toThrow('URL HTTPS valido');
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([
    'https://github.com/derpsyhome/3rd-party-books-for-5e',
    'https://github.com/derpsyhome/3rd-party-books-for-5e.git',
    'https://github.com/derpsyhome/3rd-party-books-for-5e/tree/main',
    'https://github.com/owner/repo/blob/main/system.json'
  ])('explains GitHub pages without claiming CORS: %s', async url => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    await expect(importFromUrl(url)).rejects.toThrow('pagina GitHub');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('accepts real byte responses from raw and Pages hosts, strips query provenance and omits credentials', async () => {
    const fetch = vi.fn(async () => new Response(gzip(demoOriginal), { headers: { 'content-type': 'application/octet-stream' } }));
    vi.stubGlobal('fetch', fetch);
    const imported = await importFromUrl('https://raw.githubusercontent.com/owner/repo/main/5e/system.rpg?download=1');
    expect(imported.artifact).toBeDefined();
    expect(imported.source).toBe('https://raw.githubusercontent.com/owner/repo/main/5e/system.rpg');
    expect(fetch).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ credentials: 'omit', referrerPolicy: 'no-referrer', signal: expect.any(AbortSignal) }));
    expect((await importFromUrl('https://owner.github.io/repo/5e/system.rpg')).definition.id).toBe('polysheet-sentieri');
  });
  it('distinguishes HTTP, HTML content types, and disguised HTML bodies', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>Error</html>', { status: 404, headers: { 'content-type': 'text/html' } })));
    await expect(importFromUrl('https://files.example/a')).rejects.toThrow('HTTP 404');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>Not JSON</html>', { headers: { 'content-type': 'text/html' } })));
    await expect(importFromUrl('https://files.example/a')).rejects.toThrow('pagina HTML');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(' \n<html>Not JSON</html>', { headers: { 'content-type': 'text/plain' } })));
    await expect(importFromUrl('https://files.example/a')).rejects.toThrow('pagina HTML');
  });
  it('distinguishes network/CORS failures, timeouts, invalid JSON and invalid UTF-8', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    await expect(importFromUrl('https://files.example/a')).rejects.toThrow('rete o da CORS');
    vi.stubGlobal('fetch', vi.fn(async () => { throw new DOMException('Timed out', 'TimeoutError'); }));
    await expect(importFromUrl('https://files.example/a')).rejects.toThrow('15 secondi');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{bad')));
    await expect(importFromUrl('https://files.example/a')).rejects.toThrow('JSON malformato');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(Uint8Array.from([0xc3, 0x28]))));
    await expect(importFromUrl('https://files.example/a')).rejects.toThrow('UTF-8 valida');
  });
  it('bounds declared and actual network bytes independently', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { headers: { 'content-length': String(MAX_SYSTEM_BYTES + 1) } })));
    await expect(importFromUrl('https://files.example/a')).rejects.toThrow('troppo grande');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array(MAX_SYSTEM_BYTES + 1))));
    await expect(importFromUrl('https://files.example/a')).rejects.toThrow('troppo grande');
  });
  it.each(['system.rpgs', 'resources.rpg.gzip', 'pack.zip'])('rejects unsupported archive URLs: %s', async name => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    await expect(importFromUrl('https://files.example/' + name)).rejects.toThrow('Formato non supportato');
    expect(fetch).not.toHaveBeenCalled();
  });
});

for (const [file, version] of [
  ['.reference/archer-system.rpg', '0.9.1'],
  ['.reference/derpsy-system.rpg', '0.6.0']
]) {
  it.skipIf(!existsSync(resolve(file)))(`verifies real gzip system ${file} without conversion`, async () => {
    const bytes = Uint8Array.from(readFileSync(resolve(file)));
    const imported = await prepareImport(bytes, file);
    expect(imported.definition.version).toBe(version);
    expect(imported.definition.character_stats).toHaveLength(317);
    expect(imported.definition.resources).toHaveLength(50);
    expect(imported.diagnostics.filter(d => d.severity === 'error')).toEqual([]);
    expect(artifactBytes(imported.artifact!.base64)).toEqual(bytes);
    expect(createEvaluator(imported.definition.character_stats, { strength_score: 15 }).get('strength_modifier')).toBe(2);
  });
}

for (const [id, version, digest, stats, definitions, warnings] of [
  ['5e', '0.9.1', '5de5642ad7281d7a99566a518d916e43c24f0c2046c4c40b8042e5074ac3ea3b', 317, 50, 22],
  ['5e2024', '0.9.1', 'ce0ff5a339a0412b5c5c971680c5d009c2a7e04bd9cb65b9cafd8670966c9ad6', 317, 50, 22],
  ['pf2e', '0.3.0', 'a0f6f3d56e432e1f60625b06e374c21af8237ec01f3ef93024ed45c321b3e679', 760, 61, 38]
] as const) {
  const file = resolve(`.reference/official-releases-2026-11-16/${id}-system.rpg`);
  it.skipIf(!existsSync(file))(`imports unchanged official ${id} and sorts omitted sortBy orders ascending`, async () => {
    const bytes = Uint8Array.from(readFileSync(file));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(digest);
    const imported = await prepareImport(bytes, file);
    expect(imported.definition.id).toBe(id);
    expect(imported.definition.version).toBe(version);
    expect(imported.definition.character_stats).toHaveLength(stats);
    expect(imported.definition.resources).toHaveLength(definitions);
    expect(imported.diagnostics.filter(d => d.severity === 'error')).toEqual([]);
    expect(imported.diagnostics).toHaveLength(warnings);
    expect(imported.diagnostics.filter(d => /sortBy/.test(d.message))).toEqual([]);
    expect(imported.diagnostics.filter(d => /synchronous/.test(d.message))).toEqual([]);
    // The real `is_defeated = current_hp <= 0` formula checks cleanly; combatant entries name the missing generator.
    expect(imported.diagnostics.filter(d => d.path.includes('is_defeated'))).toEqual([]);
    // Every declared sort option resolves its stat, enumeration or option resource.
    expect(imported.diagnostics.filter(d => d.path.includes('sort_options'))).toEqual([]);
    expect(imported.diagnostics.filter(d => d.path.endsWith('.is_combatant_entry')).map(d => d.message))
      .toEqual([expect.stringContaining('generazione automatica degli incontri')]);
    expect(artifactBytes(imported.artifact!.base64)).toEqual(bytes);
    if (id === '5e') {
      const sort = imported.definition.character_stats.find(s => s.id === 'race_traits')!.components!;
      expect(sort.type).toBe('sortBy');
      expect(sort.components).toEqual({ type: 'stat', stat: 'race.current_level_traits' });
      expect(Object.hasOwn(sort, 'order')).toBe(false);
      const traits = [{ min_level: 4, id: 'late' }, { min_level: 1, id: 'first' }, { min_level: 1, id: 'second' }];
      const e = createEvaluator([], {}, undefined, { variables: { race: { current_level_traits: traits } } });
      expect(e.evaluate(sort)).toEqual([traits[1], traits[2], traits[0]]);
      expect(traits.map(t => t.id)).toEqual(['late', 'first', 'second']);
    }
    const database = new SheetDatabase(`official-${crypto.randomUUID()}`);
    try {
      await installSystem(imported, database);
      await installSystem(imported, database);
      expect(await database.systems.count()).toBe(1);
      const backup = await exportBackup(database);
      await restoreBackup(backup, database);
      const restored = (await database.systems.get(imported.key))!;
      expect(restored.digest).toBe(digest);
      expect(restored.original).toBe(imported.original);
      expect(restored.diagnostics).toEqual(imported.diagnostics);
      expect(artifactBytes(restored.artifact!.base64)).toEqual(bytes);
    } finally { await database.delete(); }
  });
}
