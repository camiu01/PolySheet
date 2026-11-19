/** @file Recognizable remote game choices, without bundled third-party rules. */
import { useEffect, useRef } from 'react';
import { BookOpen, LoaderCircle } from 'lucide-react';
import { it } from './it';

/** The game being prepared: the current phase, with a count once catalog downloads start. */
export interface GameProgress { id: string; phase: string; done?: number; total?: number }

/** Only verified importable sources offer an action; availability is not full rule support. */
export function GameChoices({ busy, onChoose, installed = [], onUse, progress, error }: {
  busy: boolean; onChoose: (id: string) => void;
  /** Shown inside the chosen row, where the tap happened, so it stays visible on phones. */
  progress?: GameProgress | null; error?: { id: string; message: string } | null;
  /** Source ids already in the library; those rows lead to the characters instead of preparing again. */
  installed?: string[]; onUse?: (id: string) => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => { if (progress?.id || error?.id) panel.current?.scrollIntoView?.({ block: 'nearest' }); }, [progress?.id, error?.id]);
  return <section className="system-import" aria-labelledby="game-choices-heading">
    <h2 id="game-choices-heading">{it.gameChoicesTitle}</h2><p className="muted">{it.gameChoicesHelp}</p>
    {/* PF2e uses the same entry action, but its source syntax error requires the guided compiled-file step. */}
    {[{ id: '5e', name: it.game2014 }, { id: '5e2024', name: it.game2024 },
      { id: 'pf2e', name: 'Pathfinder 2e' }].map(game =>
      <div className="import-source-row" key={game.id}>
        <BookOpen size={22} aria-hidden="true" /><div><h3>{game.name}</h3><p>{game.id === 'pf2e' ? it.pathfinderHelp : it.gameSourceHelp}</p></div>
        {installed.includes(game.id) && onUse
          ? <button className="button secondary" disabled={busy} onClick={() => onUse(game.id)}
            aria-label={`${it.useGame} · ${game.name}`}>{it.useGame}</button>
          : <button className="button primary" disabled={busy} onClick={() => onChoose(game.id)}
            aria-label={`${it.gamePrepare} · ${game.name}`}>{progress?.id === game.id
              ? <><LoaderCircle size={16} className="spin" aria-hidden="true" />{it.gameLoadingShort}</> : it.gamePrepare}</button>}
        {progress?.id === game.id && <div ref={panel} className="game-progress" role="status">
          <LoaderCircle size={22} className="spin" aria-hidden="true" />
          <div><strong>{it.gameLoading(game.name)}</strong>
            <span>{progress.phase}{progress.total ? `: ${progress.done ?? 0}/${progress.total}` : ''}</span>
            <progress aria-label={it.gameLoading(game.name)} max={progress.total || undefined}
              value={progress.total ? progress.done ?? 0 : undefined} />
            <small className="muted">{it.gameLoadingHelp}</small></div>
        </div>}
        {!progress && error?.id === game.id && <div ref={panel} className="game-progress game-failed">
          <div><strong>{it.gameFailed(game.name)}</strong><span>{error.message}</span><small>{it.gameRetry}</small></div>
        </div>}
      </div>)}
    <details className="import-format-help"><summary>{it.gameUnavailable}: Daggerheart</summary>
      <p><strong>Daggerheart:</strong> {it.daggerheartUnavailable}</p>
    </details>
  </section>;
}
