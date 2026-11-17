/** @file Documented recursive split-source composition, ordered by exact filename. */
import type { Json } from '../../domain/model';

const isObject = (value: Json): value is Record<string, Json> => value !== null && !Array.isArray(value) && typeof value === 'object';
const baseName = (name: string) => name.replace(/(?:\.rpg)?\.json$|\.rpgs$/, '');

/** Deep merge objects; concatenate arrays, merging only documented resource/stat IDs. */
export function mergeSource(left: Json, right: Json, key = '', depth = 0): Json {
  if (depth > 64) throw new Error('Composition depth exceeds 64');
  if (Array.isArray(left) && !Array.isArray(right)) return [...left, right];
  if (Array.isArray(left) && Array.isArray(right)) {
    if (!['resources', 'stats'].includes(key)) return [...left, ...right];
    const result = [...left];
    for (const item of right) {
      const index = isObject(item) && typeof item.id === 'string'
        ? result.findIndex(old => isObject(old) && old.id === item.id) : -1;
      if (index < 0) result.push(item);
      else result[index] = mergeSource(result[index], item, key, depth + 1);
    }
    return result;
  }
  if (isObject(left) && isObject(right)) {
    const result = { ...left };
    for (const [name, value] of Object.entries(right)) {
      if (['__proto__', 'prototype', 'constructor'].includes(name)) throw new Error('Forbidden composition key');
      result[name] = Object.hasOwn(result, name) ? mergeSource(result[name], value, name, depth + 1) : value;
    }
    return result;
  }
  return right;
}

/** Compose one directory, preserving explicit array indexes and lexical child order. */
export function composeDirectory(files: ReadonlyMap<string, string>, directory: string,
  read: (path: string) => Json | undefined, root = false, depth = 0): Json {
  if (depth > 32) throw new Error('Source directory depth exceeds 32');
  const children = new Set<string>(), prefix = directory + '/';
  for (const path of files.keys()) if (path.startsWith(prefix)) children.add(path.slice(prefix.length).split('/')[0]);
  const ordered = [...children].sort();
  const indexNames = root ? ['system.rpg.json', 'system.json'] : ['index.rpg.json', 'index.json', 'index.rpgs'];
  const indexes = ordered.filter(name => indexNames.includes(name) && files.has(prefix + name));
  const selectedIndex = indexes.find(name => name.endsWith('.rpgs')) ?? indexes[0];
  const initial = selectedIndex ? read(prefix + selectedIndex) : undefined;
  const entries: { name: string; value: Json; folder: boolean }[] = [];
  for (const name of ordered.filter(name => !indexes.includes(name))) {
    const path = prefix + name, folder = !files.has(path);
    const value = folder ? composeDirectory(files, path, read, false, depth + 1) : read(path);
    if (value !== undefined && !(Array.isArray(value) && !value.length && name === 'macros'))
      entries.push({ name, value, folder });
  }
  const array = Array.isArray(initial) || initial === undefined && !root && entries.every(e => !e.folder);
  if (array) return entries.reduce<Json[]>((items, entry) =>
    [...items, ...(Array.isArray(entry.value) ? entry.value : [entry.value])], Array.isArray(initial) ? initial : []);
  let result: Json = initial ?? {};
  if (!isObject(result)) throw new Error(`${directory}: expected an object index`);
  for (const entry of entries) {
    const name = baseName(entry.name);
    if (['__proto__', 'prototype', 'constructor'].includes(name)) throw new Error('Forbidden source filename');
    result = mergeSource(result, { [name]: entry.value });
  }
  return result;
}
