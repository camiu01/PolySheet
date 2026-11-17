---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: ["src/styles.css","src/ui/Characters.tsx","src/ui/Tools.tsx","src/ui/Library.tsx","src/ui/SystemImport.tsx","src/ui/library.css"]
---

# Interface surface

Mode: Operate. Targets: application shell and existing screens, desktop and phone.
The supplied desktop/mobile screenshots are the visual authority, not sample data.

## First-run clarification

Lead with recognizable game choices under "I miei GDR", using ruled rows rather
than a new visual system. D&D 2014/2024 fetch verified pinned sources into the
existing review flow; neither button promises complete rules automation.
Disclose unavailable PF2e/Daggerheart sources without a fake import action.
File/link choices stay available below. Sentieri says "Sistema di prova",
explicitly identifies itself as a demo, not D&D, and never claims hidden rules.
New-character forms start with an empty game choice, even after demo import.
Keep the game name and demo notice visible through creation, roster and sheet.
Existing-character setup says modification, not creation. Native typed numeric
bases remain editable when a source does not define creation inputs.
Browser Back/Forward restores local screens, and the top bar exposes honest
operation/save feedback without a profile or fake sync status.

## Direction contract

THESIS: A local character archive in the supplied Contemporary Grimoire style.
Keep real tasks visible; no mock cloud sync, storage quotas or invented characters.

OWN-WORLD: Charcoal canvas, near-black navigation, ivory copy, brass actions,
sage success and sapphire metadata. EB Garamond headings, Plus Jakarta Sans body,
Space Mono numbers. Thin keylines and compact squared controls.

STORY: Find a saved sheet, edit its declared values, import source catalogs and
back up the archive. Compatibility warnings remain visible.

FIRST VIEWPORT: Persistent left navigation on desktop, a compact breadcrumb header,
editorial title, search/filter strip and real character entries. On phones, a
bottom bar exposes characters, systems and dice, with the drawer retaining all
other destinations. Source sheets adapt to the same compact grid. Dialogs are
centered on both desktop and phone, explicitly overriding the reference's bottom
sheets. No workspace selector, top-right profile/status group, sidebar version
footer or settings privacy promotion remains. Installation and backups remain.

FORM: User-pinned desktop and phone reference. No concept roll; seed: none
(user-supplied direction). The signature is a brass active-navigation keyline
and tabular numeric values within restrained dark sheet panels. State changes
use brief color transitions, disabled under reduced motion.

FINISH: unreviewed and undocumented is unfinished; this build ends only after
rendered desktop/mobile inspection and recorded design decisions.

## Scoped sheet interaction extension

Continue the existing Operate surface, without changing the visual system.
Guided manual creation/configuration collects actual local catalog choices and
declared base values, with explicit incomplete/unsupported-rule guidance.
Stat details and resource pickers stay centered. Long forms put the fieldset
inside a scrolling div, with stable Save/Cancel actions outside it. Resource
search spans all candidates; only 50 choices render per page. Keep imported
labels, visible diagnostics, exact originals and atomic draft semantics.
Fresh evidence includes desktop/mobile setup, configured sheets, Monster
selection and long source dialogs. Do not reuse the earlier whole-app verdict
as proof of this extension.

The beginner extension separates abilities from health. Italian explanations
and a method selector offer manual values, standard array, point buy and
explicit dice for supported D&D imports. Imported labels elsewhere stay
unchanged. A ruled list pairs ability explanations with controls; proposals
require Apply before Save. Keep the existing scrollport and stable footer.
Event results use centered dialogs with source labels and actual dice, without
fake history or automatic persistent effects.

New D&D setup adds a native checked first-level HP option. Once a class is
selected, its explanatory health section replaces raw base/current inputs;
disabling the option restores manual fields. Initial HP is assigned only on
Save. Existing character configuration must never show an automatic reset.

Resource pickers expose imported prefilters as labeled native checkboxes,
separate from name search and paged results. Search stays available during
scrolling; body-font resource names and directional glyphs identify choices.
The sheet header prioritizes configuration over the compact destructive action.
Compatibility guidance and original source labels remain visible.

## System import clarification

Keep the library heading free of the duplicate import button. One ruled panel
separates file and link choices, with short explanations and an explicit
source/preview/confirmation sequence. Sentieri is a compact secondary option.
Formats and system-versus-catalog guidance use native disclosure, not a wall
of technical prose before the first action.

The link dialog distinguishes direct system downloads from public GitHub
repositories. A specific branch/tag/commit is optional and only shown for a
repository, inside an advanced disclosure. Repository discovery asks for the
system and explains automatic local preparation of JSON and RPGScript from one
commit, without requiring a compiled file. Existing-version reuse is explicit;
the optional compiled-file alternative stays collapsed. Never imply complete
gameplay compatibility or that the publisher's CDN is proxied.

Review counts all diagnostics by topic, expands blocking errors, and leaves
precise paths and provenance available without putting them ahead of the task.
Both dialog body and review body scroll independently of their always-visible
actions. Keep confirmation-before-write, exact originals, safety limits, busy
dismissal protection and the existing centered desktop/phone dialogs.
