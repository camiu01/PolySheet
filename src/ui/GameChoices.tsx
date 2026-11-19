/** @file Recognizable remote game choices, without bundled third-party rules. */
import { BookOpen, Download, Upload } from 'lucide-react';
import { officialSystemDownload } from '../importing/repository';
import { it } from './it';

/** Only verified importable sources offer an action; availability is not full rule support. */
export function GameChoices({ busy, onChoose, installed = [], onUse }: {
  busy: boolean; onChoose: (id: string) => void;
  /** Source ids already in the library; those rows lead to the characters instead of preparing again. */
  installed?: string[]; onUse?: (id: string) => void;
}) {
  return <section className="system-import" aria-labelledby="game-choices-heading">
    <h2 id="game-choices-heading">{it.gameChoicesTitle}</h2><p className="muted">{it.gameChoicesHelp}</p>
    {[{ id: '5e', name: it.game2014 }, { id: '5e2024', name: it.game2024 }].map(game =>
      <div className="import-source-row" key={game.id}>
        <BookOpen size={22} aria-hidden="true" /><div><h3>{game.name}</h3><p>{it.gameSourceHelp}</p></div>
        {installed.includes(game.id) && onUse
          ? <button className="button secondary" disabled={busy} onClick={() => onUse(game.id)}
            aria-label={`${it.useGame} · ${game.name}`}>{it.useGame}</button>
          : <button className="button primary" disabled={busy} onClick={() => onChoose(game.id)}
            aria-label={`${it.gamePrepare} · ${game.name}`}>{it.gamePrepare}</button>}
      </div>)}
    {/* The public PF2e source has a syntax error (resources/weapon/stats.rpgs:928), so the row uses the
        publisher's compiled file: a normal download, then the same local import as «Ho già un file». */}
    <div className="import-source-row">
      <BookOpen size={22} aria-hidden="true" /><div><h3>Pathfinder 2e</h3><p>{it.pathfinderHelp}</p></div>
      {installed.includes('pf2e') && onUse
        ? <button className="button secondary" disabled={busy} onClick={() => onUse('pf2e')} aria-label={`${it.useGame} · Pathfinder 2e`}>{it.useGame}</button>
        : <div className="button-row">
          <a className="button secondary" href={officialSystemDownload('pf2e')} target="_blank" rel="noopener noreferrer"
            aria-label={`${it.pathfinderDownload} · Pathfinder 2e`}><Download size={16} aria-hidden="true" />{it.pathfinderDownload}</a>
          <button className="button primary" disabled={busy} onClick={() => onChoose('pf2e')}
            aria-label={`${it.pathfinderUpload} · Pathfinder 2e`}><Upload size={16} aria-hidden="true" />{it.pathfinderUpload}</button>
        </div>}
    </div>
    <details className="import-format-help"><summary>{it.gameUnavailable}: Daggerheart</summary>
      <p><strong>Daggerheart:</strong> {it.daggerheartUnavailable}</p>
    </details>
  </section>;
}
