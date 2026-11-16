/** @file Read-only catalog URLs and bounded folders; no HTML crawling, compiler or proxy. */
import { object, type StoredSystem } from '../domain/model';
import { prepareCatalogTemplate, MAX_REPOSITORY_CATALOG_BYTES, MAX_REPOSITORY_CATALOG_FILES, type CatalogPreview } from './catalog';
import { githubRepository, listGithubFiles } from './github';
import { boundedJson, decodeUtf8, MAX_SYSTEM_BYTES } from './system';
import { downloadBytes } from './url';
import { it } from '../ui/it';

function address(input: string) {
  let url: URL;
  try { url = new URL(input); } catch { throw new Error(it.invalidUrl); }
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error(it.invalidUrl);
  return url;
}
function provenance(url: URL) { return url.origin + url.pathname; }
function checkCount(count: number) {
  if (!count || count > MAX_REPOSITORY_CATALOG_FILES) throw new Error(count ? it.catalogRemoteLimit : it.catalogNoFiles);
}
async function fromGithub(input: string, system: StoredSystem, ref: string): Promise<CatalogPreview[]> {
  let repository: string | null, folder = '', file = false;
  // Root clone forms use the existing public normalizer.
  if (!/^https:\/\//i.test(input)) repository = githubRepository(input);
  else {
    const url = address(input), parts = url.pathname.split('/').filter(Boolean);
    if (parts.length <= 2) repository = githubRepository(input);
    else {
      if (!['tree', 'blob'].includes(parts[2]) || parts.length < 4) throw new Error(it.githubPage);
      repository = githubRepository(`https://${url.host}/${parts[0]}/${parts[1]}`);
      let tail: string;
      try { tail = parts.slice(3).map(decodeURIComponent).join('/'); } catch { throw new Error(it.repositoryInvalid); }
      // shortcut: slash-containing GitHub refs need the explicit ref field to disambiguate them from paths.
      const selectedRef = ref.trim() || decodeURIComponent(parts[3]);
      if (tail !== selectedRef && !tail.startsWith(selectedRef + '/')) throw new Error(it.catalogRefMismatch);
      folder = tail.slice(selectedRef.length).replace(/^\//, '');
      if (folder && folder.split('/').some(p => !p || p === '.' || p === '..' || /[\\\u0000-\u001f\u007f]/.test(p))) throw new Error(it.repositoryInvalid);
      ref = selectedRef; file = parts[2] === 'blob';
      if (file && !/\.json$/i.test(folder)) throw new Error(it.catalogFormat);
    }
  }
  if (!repository) throw new Error(it.repositoryUnsupported);
  const snapshot = await listGithubFiles(repository, ref);
  let files = snapshot.files.filter(f => /\.json$/i.test(f.path)
    && (file ? f.path === folder : !folder || f.path.startsWith(folder.replace(/\/$/, '') + '/')));
  const conventional = files.filter(f => f.path.startsWith(`systems/${system.definition.id}/resource_instances/`)
    && /\/(?:class|race|species|ancestry|heritage|background)_[^/]+\.rpg\.json$/i.test(f.path));
  if (!file && (!folder || folder === `systems/${system.definition.id}/resource_instances`) && conventional.length) files = conventional;
  checkCount(files.length);
  if (files.some(f => f.size > MAX_SYSTEM_BYTES) || files.reduce((n, f) => n + f.size, 0) > MAX_REPOSITORY_CATALOG_BYTES)
    throw new Error(it.catalogRemoteLimit);
  const previews: CatalogPreview[] = [];
  for (let i = 0; i < files.length; i += 4) {
    previews.push(...await Promise.all(files.slice(i, i + 4).map(async f => {
      const url = new URL(`https://raw.githubusercontent.com/${repository.slice('https://github.com/'.length)}/${snapshot.commit}/${f.path.split('/').map(encodeURIComponent).join('/')}`);
      const bytes = await downloadBytes(url);
      if (bytes.length !== f.size) throw new Error(it.repositoryChanged);
      return prepareCatalogTemplate(decodeUtf8(bytes), url.href, system);
    })));
  }
  return previews;
}

/**
 * Prepare one JSON original, an index.json folder, or a GitHub root/tree/blob link.
 * @remarks No writes. Web indexes contain only {files: string[]}; paths stay below
 * the index directory. Indexes do not recurse. Query strings never enter provenance.
 */
export async function importCatalogUrl(input: string, system: StoredSystem, ref = ''): Promise<CatalogPreview[]> {
  const trimmed = input.trim();
  if (/^(?:git@github\.com:|(?:ssh|git):\/\/(?:git@)?github\.com\/)/i.test(trimmed))
    return fromGithub(trimmed, system, ref);
  const url = address(trimmed);
  if (['github.com', 'www.github.com'].includes(url.hostname)) return fromGithub(trimmed, system, ref);
  if (/\.(?:gz|gzip|rpg|rpgs|zip)$/i.test(url.pathname)) throw new Error(it.catalogFormat);
  if (!/\.json$/i.test(url.pathname)) {
    url.pathname = url.pathname.replace(/\/?$/, '/') + 'index.json';
    url.search = ''; url.hash = '';
  }
  const bytes = await downloadBytes(url), original = decodeUtf8(bytes), parsed = object(boundedJson(original));
  if (!Object.hasOwn(parsed, 'files')) return [await prepareCatalogTemplate(original, provenance(url), system)];
  if (Object.keys(parsed).some(k => k !== 'files') || !Array.isArray(parsed.files)) throw new Error(it.catalogIndexInvalid);
  checkCount(parsed.files.length);
  const base = new URL('./', url), seen = new Set<string>();
  const files = parsed.files.map(path => {
    if (typeof path !== 'string' || path.length > 1024) throw new Error(it.catalogIndexInvalid);
    let decoded: string;
    try { decoded = decodeURIComponent(path); } catch { throw new Error(it.catalogIndexInvalid); }
    if (/[\\%?#\u0000-\u001f\u007f]/.test(decoded) || decoded.split('/').some(p => !p || p === '.' || p === '..'))
      throw new Error(it.catalogIndexInvalid);
    const target = new URL(decoded, base);
    if (target.origin !== base.origin || !target.pathname.startsWith(base.pathname) || !/\.json$/i.test(target.pathname)
      || seen.has(target.href)) throw new Error(it.catalogIndexInvalid);
    seen.add(target.href); return target;
  });
  const previews: CatalogPreview[] = [];
  let total = bytes.length;
  // Unknown file sizes require sequential reads against the remaining aggregate budget.
  for (const target of files) {
    const content = await downloadBytes(target, false, MAX_REPOSITORY_CATALOG_BYTES - total);
    total += content.length;
    previews.push(await prepareCatalogTemplate(decodeUtf8(content), provenance(target), system));
  }
  return previews;
}
