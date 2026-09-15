/**
 * The Coding Bench's slot bodies and the sidebar panel-list glyph.
 *
 * The bodies are mounted from the slot registrations in `index.ts`. Each body
 * accepts the runtime share its slot provides (the framework's standard kit
 * merged with this plugin's inject face); everything it draws comes from the
 * bound translate, so a language switch re-renders the body without the
 * registering fiber doing any work.
 *
 * M2 ships placeholders — the real file tree, the editor, the multi-tab +
 * multi-pane layout, the keymap and the theme all land in their own modules
 * after this one. The bodies keep their current signature and shape, so
 * later milestones can replace what is inside `return` without touching
 * either the slot registrations or the CSS.
 */
import type { ReactNode } from 'react'
import type { PropsRuntime, TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'

export type CodingBenchSlot = 'main' | 'bench-page'

/** The translate function bound by the host for this plugin's `coding-bench`
 *  namespace. It is locale-reactive, so re-renders on a language switch. */
export type CodingBenchTranslate = TranslateNS<'coding-bench'>

/** The inject face every Coding Bench body / title slot receives. Re-exported
 *  from `index.ts` so the slot-bound component types and the `apply` body
 *  agree on one shape. */
export interface CodingBenchInjected {
  /** The `coding-bench` namespace translate function. */
  wt: CodingBenchTranslate
}

/** The composed props of the `main`-slot body. */
export type CodingBenchPanelProps = PropsRuntime<'main'> & CodingBenchInjected

/** The composed props of the right-column page body. */
export type CodingBenchPageProps = PropsRuntime<'sidebar.right.pane.tab'> & CodingBenchInjected

/** The composed props of the right-column page chip. */
export type CodingBenchPageChipProps = PropsRuntime<'sidebar.right.pane.tab.title'> & CodingBenchInjected

/** Main-column body: a quiet landing page that points at the right column. */
export function MainSlotBody(props: CodingBenchPanelProps): ReactNode {
  const t = props.wt
  return (
    <div className="cb-main" role="region" aria-label={t('title')}>
      <h1 className="cb-main__title">{t('title')}</h1>
      <p className="cb-main__subtitle">{t('subtitle')}</p>
      <p className="cb-main__placeholder">{t('placeholder.main')}</p>
    </div>
  )
}

/** Right-column body: a TODO placeholder for the upcoming explorer + editor
 *  area. The two-column layout it describes (left = file tree, right = editor)
 *  is what the next milestones will fill in. */
export function BenchPageBody(props: CodingBenchPageProps): ReactNode {
  const t = props.wt
  return (
    <div className="cb-page" role="region" aria-label={t('title')}>
      <div className="cb-page__explorer">
        <strong>{t('bench.todo.explorer')}</strong>
      </div>
      <div className="cb-page__editor">
        <strong>{t('bench.todo.editor')}</strong>
        <p>{t('placeholder.bench')}</p>
      </div>
      <footer className="cb-page__foot">
        <span>{t('foot.hint')}</span>
      </footer>
    </div>
  )
}

/** The right-column page chip. The chip is the title text rendered in the
 *  tab strip while the page is open; M6 replaces it with a real per-file tab. */
export function BenchPageChip(props: CodingBenchPageChipProps): ReactNode {
  return <span className="cb-chip">{props.wt('title')}</span>
}

/** The sidebar panel-list glyph: a one-line identifier. The icon is rendered
 *  by the slot system from any SVG string the implementation returns; this is
 *  the small "code" prompt glyph for now, swapped for a proper icon when the
 *  visual pass lands. */
export function CodingBenchPanelIcon(): ReactNode {
  return <span aria-hidden="true" className="cb-icon">{'</>'}</span>
}
