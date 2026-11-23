# Public GitHub system retrieval

[← README](../README.md) · [Docs index](README.md)

## Use

For D&D, open **I miei GDR** and choose the 2014 or 2024 edition.
These shortcuts prepare the verified source commit
`8788e3b18099e4a1b3510f02869d97f1488586b4`, including its catalogs, through the
same preview and explicit confirmation below. Internet is required; no rules
are bundled. Partial gameplay support remains visible. The 2024 preview
identifies 19 nonassignable catalog templates rather than hiding them.

Sentieri is the original included demonstration, labeled **Sistema di prova**,
not D&D. Every new character starts with an empty game selection, even if only
the demo is installed. Existing characters stay pinned to their own imports.
PF2e's known source error and the absence of a verified compatible Daggerheart
source are disclosed; neither is presented as a working shortcut. Other
compatible files, including compiled PF2e, can still be imported explicitly.

To use another file or source:

1. Open **I miei GDR → Incolla un link**.
2. Enter a public GitHub repository root, optionally ending in `.git`.
3. Optionally enter a branch, tag or commit. An empty field uses the default branch.
4. Choose **Carica anteprima**. Ordinary distribution repositories show a file
   selector; source repositories with the supported layout show their systems.
5. Review the prepared system, catalogs and diagnostics. Only
   **Conferma importazione** writes to IndexedDB. Cancelling installs nothing.

For an ordinary repository, select `system.rpg`, `system.rpg.json` or
`system.json`, then choose **Carica file selezionato**. For example,
[derpsyhome/3rd-party-books-for-5e](https://github.com/derpsyhome/3rd-party-books-for-5e)
contains a compiled system, not supported book archives.

HTTPS roots, `git@github.com:owner/repo.git`, `ssh://git@github.com/owner/repo.git`
and `git://github.com/owner/repo.git` normalize to the same public HTTPS reader.
These forms never invoke Git or SSH. Other Git hosts, private repositories and
authenticated URLs are unsupported. In the system library, GitHub `blob`/`tree`
pages are rejected; use a root URL plus the reference field. The separate
[resource-link importer](VIEWS.md#resource-links) accepts file/folder page links.
Direct HTTPS JSON/gzip-JSON system imports remain available.

## Source repositories and automatic catalogs

For [blastervla/rpg-companion-app-systems](https://github.com/blastervla/rpg-companion-app-systems):

1. Paste the repository URL and choose **Carica anteprima**. The pinned metadata
   identifies **5e**, **5.5e** (source ID `5e2024`) and **Pathfinder 2e (Remaster)**.
   Names and versions come from the repository, not a fixed system list.
2. Choose a system. JSON and RPGScript sources are prepared locally by default;
   no local file is required, including when another import is already installed.
3. Optionally choose an installed exact-ID/version import to reuse its rules
   instead. The selector shows its digest. A compiled-file alternative remains
   under **Usa un file già compilato (facoltativo)**. Neither alternative is
   required for supported source trees. The CORS-blocked CDN is never fetched.
4. Choose **Carica sistema e cataloghi**. PolySheet reads all discovered class,
   race/species, background, ancestry and heritage JSON files for that system at the pinned
   GitHub commit. No files are installed during this download.
5. Review totals and nonassignable entries, then confirm once. The system and
   catalog originals install atomically. Later imports can compose sources
   again or explicitly reuse an installed system.

The repository's root JSON alone is not a complete system. PolySheet downloads
its JSON/RPGScript siblings and transitive shared macros from the same immutable
commit, composes them without executing imported code, and validates the result
normally. Unknown syntax, missing dependencies or invalid definitions block
preparation, never silently omit rules. The inspected PF2e tree currently fails
at `resources/weapon/stats.rpgs:928:3`; see the
[source compiler evidence](COMPATIBILITY.md#browser-source-compiler-2026-11-17).
Compilation does not establish full gameplay compatibility.

The same source/catalog convention works in other public repositories:
`systems/<id>/system/system.rpg.json` plus matching
`systems/<id>/resource_instances/` JSON files. Download-host shortcuts are
provided only for the inspected publisher, never guessed from remote scripts.

Only the catalog root types above are included. Nested content within
those templates is retained, but separate spell/item/background libraries and
`resources.rpg.gzip` archives are not imported by this workflow.
See [catalog use and manual assignment](VIEWS.md#catalogs-and-character-assignment).

## Contract and provenance

Public endpoints:

- [List commits](https://docs.github.com/en/rest/commits/commits#list-commits):
  `GET /repos/{owner}/{repo}/commits?per_page=1`, optionally with `sha`.
  The result identifies an immutable commit and its root tree.
- [Get a tree](https://docs.github.com/en/rest/git/trees#get-a-tree):
  `GET /repos/{owner}/{repo}/git/trees/{tree_sha}?recursive=1`.
  Only complete trees and regular blobs qualify.
- Read selected files from
  `https://raw.githubusercontent.com/{owner}/{repo}/{commit}/{path}`.
  Response-supplied URLs never choose the download host.

Conventional system filenames are case-insensitive. Symlinks, submodules,
distribution indexes and archives are not system candidates. Source catalogs
are separately recognized by their supported directory and filename prefixes;
their declared resource type is checked before installation.

A moving branch cannot switch the resolved commit mid-import. Catalog provenance
retains its commit-pinned Raw URL, exact UTF-8 original and SHA-256 digest.
Explicitly reused compiled systems retain their own exact-upload identity.
New source imports retain exact file texts, BOM and line endings inside the
generated document's `polysheet_source` envelope (`format`, `root`, `files`).
**Esporta sistema e sorgenti** exports that document, not a claimed original
compiled upload. Its hash and embedded originals survive existing v4 backups.
Neither path migrates characters or overwrites an immutable import.

## Removing an installed system

On its library card, choose **Rimuovi sistema**. The confirmation identifies the
exact version and full digest. Confirming removes that import, all its resources
(including catalog originals/private copies) and its roll history. Other versions
and preferences remain unchanged.

Existing characters or encounters pinned to that import block the entire
operation; nothing is migrated or silently deleted. Remove those records
explicitly first if intended. Creation commands recheck the installed system in
the same transaction, so a stale form in another tab cannot create orphan pins.
Export a complete backup in **Impostazioni** before removal. Restoring it replaces
the complete local archive, not just the removed system.

## Bounds and failure behavior

- Two public API reads. Source mode additionally reads matching system metadata,
  then selected JSON/RPGScript sources and all catalog files, four at a time.
  No Git clone, recursive HTTP crawl, archive download, native compiler,
  background sync or automatic retry.
- Each response: 8 MiB and 15 seconds. Existing JSON/decompression limits remain.
  Catalog batch: at most 1,000 files and 24 MiB total declared/verified source bytes.
  Source parts and transitive macro imports: 1,000 files/8 MiB combined. The
  generated document, including exact originals, must still fit 8 MiB, 400,000
  nodes and depth 64. Macro/import recursion is bounded at 32; tokens at 400,000.
- At most 20,000 tree entries and 100 system candidates. Truncated/oversized
  trees, duplicate/unsafe paths and inconsistent sizes fail explicitly.
- A system/catalog candidate over 8 MiB blocks discovery. Each downloaded file
  must match its declared size; Git LFS substitution is not supported.
- A failed download aborts preparation. Structurally identifiable but incompatible
  templates are retained with a visible reason and cannot be assigned; unknown
  roots or malformed JSON fail preparation rather than disappearing.
- Installation reparses originals and runs in one transaction. If record or
  bounded-backup limits would be exceeded, nothing in the bundle installs.
- Requests omit credentials/referrers and use no token. GitHub receives ordinary
  request/IP metadata and the public repository/ref/path, never local characters,
  photos or backups. Rate limits, missing repositories, HTTP and CORS failures
  remain visible. No browser restriction is bypassed.

## Verification

`tests/github.test.ts`, `tests/repository.test.ts`, `tests/rpgscript.test.ts`,
`tests/source-repository.test.ts` and `tests/catalog.test.ts`
cover URL normalization, commit pinning, safe discovery, local ID/version
matching, budgets, atomic writes, private graphs, immutable originals and backups.
Source browser cases additionally type the URL character by character and verify
file-free preparation, cancellation, original export, offline reopening and restore.
Always-on browser fixtures use original MIT content. Optional local real-source
cases exercise all three inspected catalogs; see [fixture setup](DEVELOPMENT.md#external-fixtures).

An intentional live check uses real GitHub responses and a local official
`5e2024-system.rpg` fixture, without request interception:

```powershell
$env:PLAYWRIGHT_PORT = '4183'
$env:PLAYWRIGHT_BASE_PATH = '/PolySheet/'
$env:LIVE_REPOSITORY_IMPORT = '1'
npm run test:e2e -- --grep 'live published repository'
Remove-Item Env:LIVE_REPOSITORY_IMPORT
```

The independent compiled-file GitHub reader still has its live derpsy check:

```powershell
$env:LIVE_GITHUB_IMPORT = '1'
npm run test:e2e -- --grep 'live public GitHub'
Remove-Item Env:LIVE_GITHUB_IMPORT
```

Run against a production build. See [executed results](VERIFICATION.md);
controlled fixtures do not prove public availability or browser CORS.
