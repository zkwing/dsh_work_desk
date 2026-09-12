/**
 * Workbench: the sidebar-foot trigger plus the full-viewport control room it
 * opens. The trigger occupies `sidebar.footer.action`, so the workbench is one
 * more occupant of the sidebar shell's own foot seat and never rewrites the
 * shell. The overlay renders through a portal on `document.body` because the
 * sidebar column clips its children during the collapse slide.
 *
 * State is browser-local (see state.ts): the roster is user-defined and
 * persisted in `localStorage`, and every reading in the control room's live
 * strip is derived from that roster plus the wall clock — no fabricated
 * telemetry, no Host service, no session-log event.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  IconCloseOutline16, IconFolderOpenOutline16, IconGaugeOutline16, IconPlusOutline16,
  IconRefreshOutline16, IconTrashOutline16, Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { SidebarFooterActionOwnerProps } from '../contract/slots.ts'
import {
  ACCENTS, STATUSES, clockText, createProject, dateText, loadState, progressOf, saveState, summarize,
  type ControlRoomReading, type WorkbenchAccent, type WorkbenchProject, type WorkbenchProjectStatus,
} from './state.ts'
import css from './Workbench.module.css'

/**
 * The `workbench` namespace's translate function. The registration's own
 * `locale` seat carries its namespace, but this component also reads keys from
 * its own helpers and cards, so the sidebar plugin binds the namespace and
 * hands the stable function down through the inject face.
 */
export type WorkbenchTranslate = TranslateNS<'workbench'>

/** Props this occupant receives: the sidebar foot's owner share plus the bound translate. */
export type WorkbenchTriggerProps = SidebarFooterActionOwnerProps & {
  /** The `workbench` namespace's translate function. */
  wt: WorkbenchTranslate
}

/** Translated label for a project status. */
function statusLabel(t: WorkbenchTranslate, status: WorkbenchProjectStatus): string {
  switch (status) {
    case 'active': return t('status.active')
    case 'paused': return t('status.paused')
    case 'shipped': return t('status.shipped')
    case 'archived': return t('status.archived')
  }
}

/** Translated label for an accent swatch. */
function accentLabel(t: WorkbenchTranslate, accent: WorkbenchAccent): string {
  switch (accent) {
    case 'azure': return t('accent.azure')
    case 'violet': return t('accent.violet')
    case 'amber': return t('accent.amber')
    case 'emerald': return t('accent.emerald')
    case 'rose': return t('accent.rose')
    case 'slate': return t('accent.slate')
  }
}

/** Percentage text for a card's progress bar. */
function percentText(project: WorkbenchProject): string {
  if (project.total <= 0) return '—'
  return `${Math.round(progressOf(project) * 100)}%`
}

/**
 * Render one project card. Every field is edited in place: the card IS the
 * form, so the roster needs no separate editor surface.
 * @param props - project, translated labels, and the mutation callbacks.
 * @returns the card element.
 */
function ProjectCard({ project, t, onChange, onRemove }: {
  project: WorkbenchProject
  t: WorkbenchTranslate
  onChange: (id: string, patch: Partial<WorkbenchProject>) => void
  onRemove: (id: string) => void
}) {
  const progress = progressOf(project)
  return (
    <article className={`${css.card} ${css[`accent_${project.accent}`] ?? ''}`} data-status={project.status}>
      <header className={css.cardHead}>
        <span className={css.cardGlyph} aria-hidden="true">
          <IconFolderOpenOutline16 size={16} />
        </span>
        <input
          className={css.nameInput}
          value={project.name}
          placeholder={t('card.namePlaceholder')}
          aria-label={t('card.name')}
          onChange={event => { onChange(project.id, { name: event.target.value }) }}
        />
        <Tooltip label={t('card.remove')} delayMs={400}>
          <button
            type="button"
            className={css.iconOnly}
            aria-label={t('card.remove')}
            onClick={() => { onRemove(project.id) }}
          >
            <IconTrashOutline16 size={14} />
          </button>
        </Tooltip>
      </header>

      <input
        className={css.pathInput}
        value={project.path}
        placeholder={t('card.pathPlaceholder')}
        aria-label={t('card.path')}
        spellCheck={false}
        onChange={event => { onChange(project.id, { path: event.target.value }) }}
      />
      <input
        className={css.noteInput}
        value={project.note}
        placeholder={t('card.notePlaceholder')}
        aria-label={t('card.note')}
        onChange={event => { onChange(project.id, { note: event.target.value }) }}
      />

      <div className={css.progressRow}>
        <div
          className={css.progressTrack}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={project.total}
          aria-valuenow={project.done}
          aria-label={t('card.progress')}
        >
          <span className={css.progressFill} style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        <input
          className={css.numberInput}
          type="number"
          min={0}
          value={project.done}
          aria-label={t('card.done')}
          onChange={event => { onChange(project.id, { done: Number(event.target.value) }) }}
        />
        <span className={css.slash}>/</span>
        <input
          className={css.numberInput}
          type="number"
          min={0}
          value={project.total}
          aria-label={t('card.total')}
          onChange={event => { onChange(project.id, { total: Number(event.target.value) }) }}
        />
        <span className={css.percent}>{percentText(project)}</span>
      </div>

      <label className={css.nextRow}>
        <span className={css.nextLabel}>{t('card.next')}</span>
        <input
          className={css.nextInput}
          value={project.next}
          placeholder={t('card.nextPlaceholder')}
          onChange={event => { onChange(project.id, { next: event.target.value }) }}
        />
      </label>

      <footer className={css.cardFoot}>
        <div className={css.statusGroup} role="group" aria-label={t('card.status')}>
          {STATUSES.map(status => (
            <button
              key={status}
              type="button"
              className={`${css.statusChip} ${project.status === status ? css.statusChipActive : ''}`}
              aria-pressed={project.status === status}
              onClick={() => { onChange(project.id, { status }) }}
            >
              {statusLabel(t, status)}
            </button>
          ))}
        </div>
        <div className={css.accentGroup} role="group" aria-label={t('card.accent')}>
          {ACCENTS.map(accent => (
            <button
              key={accent}
              type="button"
              className={`${css.accentDot} ${css[`accent_${accent}`] ?? ''} ${project.accent === accent ? css.accentDotActive : ''}`}
              aria-label={accentLabel(t, accent)}
              aria-pressed={project.accent === accent}
              onClick={() => { onChange(project.id, { accent }) }}
            />
          ))}
        </div>
      </footer>
    </article>
  )
}

/**
 * Render the workbench trigger and, when open, the control-room overlay.
 * @param props - the sidebar foot's owner share (`wide`) plus the bound `workbench` translate.
 * @returns the trigger button, plus the portal-rendered overlay while open.
 */
export function WorkbenchTrigger({ wide, wt: t }: WorkbenchTriggerProps) {
  const [open, setOpen] = useState(false)
  const [projects, setProjects] = useState<WorkbenchProject[]>(() => loadState().projects)
  const [now, setNow] = useState(() => new Date())

  // The roster is the single source of truth; persistence follows every edit.
  useEffect(() => { saveState({ version: 1, projects }) }, [projects])

  // A one-second clock drives the control room's wall-clock reading and keeps
  // the "live" dot honest about the page still running.
  useEffect(() => {
    if (!open) return
    const timer = window.setInterval(() => { setNow(new Date()) }, 1000)
    return () => { window.clearInterval(timer) }
  }, [open])

  const close = useCallback(() => { setOpen(false) }, [])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, close])

  const onChange = useCallback((id: string, patch: Partial<WorkbenchProject>) => {
    setProjects(current => current.map(project => (project.id === id ? { ...project, ...patch } : project)))
  }, [])

  const onRemove = useCallback((id: string) => {
    setProjects(current => current.filter(project => project.id !== id))
  }, [])

  const onAdd = useCallback(() => {
    setProjects(current => [createProject({ name: t('card.untitled') }), ...current])
  }, [t])

  const readings = useMemo<ControlRoomReading[]>(() => {
    const summary = summarize(projects)
    return [
      {
        id: 'state',
        label: t('metric.state'),
        value: summary.counts.active > 0 ? t('metric.state.busy') : t('metric.state.ready'),
        hint: `${summary.counts.active} / ${projects.length}`,
      },
      {
        id: 'progress',
        label: t('metric.progress'),
        value: summary.total <= 0 ? '—' : `${Math.round(summary.ratio * 100)}%`,
        hint: `${summary.done} / ${summary.total}`,
      },
      {
        id: 'status',
        label: t('metric.status'),
        value: `${summary.counts.shipped}`,
        hint: t('metric.status.hint'),
      },
      {
        id: 'clock',
        label: t('metric.clock'),
        value: clockText(now),
        hint: dateText(now),
      },
    ]
  }, [projects, now, t])

  const overlay = open
    ? (
      <div className={css.overlay} role="dialog" aria-modal="true" aria-label={t('title')}>
        <button type="button" className={css.backdrop} aria-label={t('close')} onClick={close} />
        <div className={css.panel}>
          <header className={css.head}>
            <div className={css.headIdentity}>
              <span className={css.headGlyph} aria-hidden="true"><IconGaugeOutline16 size={18} /></span>
              <div className={css.headText}>
                <h2 className={css.title}>{t('title')}</h2>
                <p className={css.subtitle}>{t('subtitle')}</p>
              </div>
            </div>
            <div className={css.headActions}>
              <span className={css.live}>
                <span className={css.liveDot} aria-hidden="true" />
                {t('live')}
              </span>
              <button type="button" className={css.action} onClick={onAdd}>
                <IconPlusOutline16 size={14} />
                {t('action.add')}
              </button>
              <button
                type="button"
                className={css.action}
                onClick={() => { setProjects(current => [...current]) }}
              >
                <IconRefreshOutline16 size={14} />
                {t('action.sync')}
              </button>
              <Tooltip label={t('close')} delayMs={400}>
                <button type="button" className={css.iconOnly} aria-label={t('close')} onClick={close}>
                  <IconCloseOutline16 size={16} />
                </button>
              </Tooltip>
            </div>
          </header>

          <section className={css.readings} aria-label={t('metrics.label')}>
            {readings.map(reading => (
              <div key={reading.id} className={css.reading}>
                <span className={css.readingLabel}>{reading.label}</span>
                <span className={css.readingValue}>{reading.value}</span>
                {reading.hint !== undefined && <span className={css.readingHint}>{reading.hint}</span>}
              </div>
            ))}
          </section>

          <section className={css.projects} aria-label={t('projects.label')}>
            {projects.length === 0
              ? (
                <div className={css.empty}>
                  <span className={css.emptyGlyph} aria-hidden="true"><IconGaugeOutline16 size={22} /></span>
                  <p className={css.emptyTitle}>{t('empty.title')}</p>
                  <p className={css.emptyHint}>{t('empty.hint')}</p>
                  <button type="button" className={css.action} onClick={onAdd}>
                    <IconPlusOutline16 size={14} />
                    {t('action.add')}
                  </button>
                </div>
              )
              : projects.map(project => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  t={t}
                  onChange={onChange}
                  onRemove={onRemove}
                />
              ))}
          </section>

          <footer className={css.foot}>
            <span className={css.footHint}>{t('foot.hint')}</span>
          </footer>
        </div>
      </div>
    )
    : null

  return (
    <>
      <Tooltip label={t('trigger')} delayMs={500} disabled={wide}>
        <button
          type="button"
          className={`${css.trigger} ${wide ? css.triggerWide : ''}`}
          aria-label={t('trigger')}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => { setOpen(value => !value) }}
        >
          <span className={css.triggerGlyph} aria-hidden="true"><IconGaugeOutline16 size={wide ? 15 : 18} /></span>
          {wide && <span className={css.triggerLabel}>{t('trigger')}</span>}
          {wide && <span className={css.triggerCount}>{projects.length}</span>}
        </button>
      </Tooltip>
      {overlay}
    </>
  )
}
