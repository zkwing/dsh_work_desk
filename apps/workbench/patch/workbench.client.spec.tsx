// @vitest-environment jsdom
/**
 * Workbench occupant through the real assembly path: the sidebar shell renders
 * the foot seat, the trigger opens the control room, and the roster the room
 * shows is browser-local.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent } from '@testing-library/react'
import { SlotTestRuntime, usePinnedBrowserLanguages } from '@deepseek-ai/dsh-client-test-runtime'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { en as commonEn } from '@deepseek-ai/dsh-client-locale/src/locales/en.ts'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { apply, inject } from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { STORAGE_KEY } from '../src/client/workbench/index.ts'

// The service reads its initial locale from the browser; these specs assert the
// shipped Chinese copy, so they state the browser they assume.
usePinnedBrowserLanguages('zh-CN')

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

async function bench() {
  const runtime = await SlotTestRuntime.create()
  runtime.ctx.provide('layout', { toggleSidebar: vi.fn(), selectPanel: vi.fn() })
  runtime.ctx.provide('uiWorkspace', { startSession: vi.fn() } as never)
  const locale = new LocaleRuntime(runtime.ctx)
  locale.register('common', { zh: commonZh, en: commonEn })
  runtime.ctx.provide('locale', locale)
  runtime.slots.installLocale(locale)
  await runtime.declare({ 'sidebar': { kind: 'single', scope: 'root' } })
  await runtime.mount({ inject: [...inject], apply })
  return { runtime, locale }
}

describe('workbench occupant', () => {
  it('renders the trigger in the sidebar foot and opens the control room', async () => {
    const { runtime } = await bench()
    const slot = runtime.renderSlot('sidebar', { collapsed: false, width: 300 })

    const trigger = slot.view.getByRole('button', { name: '工作台' })
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    // Closed: the control room is not in the tree at all.
    expect(slot.view.queryByRole('dialog')).toBeNull()

    await act(async () => { fireEvent.click(trigger) })
    const dialog = slot.view.getByRole('dialog', { name: '控制室' })
    expect(dialog.textContent).toContain('本地时间')
    expect(dialog.textContent).toContain('还没有项目卡片')

    // Creating a card is the whole add flow: the card IS the editor. Two
    // buttons carry the label while the roster is empty (head + empty state).
    await act(async () => {
      fireEvent.click(slot.view.getAllByRole('button', { name: '新建项目' })[0]!)
    })
    expect(slot.view.getAllByRole('progressbar')).toHaveLength(1)
    expect((slot.view.getByLabelText('项目名称') as HTMLInputElement).value).toBe('未命名项目')
    const persisted = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as { projects?: unknown[] }
    expect(persisted.projects).toHaveLength(1)

    await runtime.dispose()
  })

  it('follows the active locale without re-registering', async () => {
    const { runtime, locale } = await bench()
    const slot = runtime.renderSlot('sidebar', { collapsed: false, width: 300 })
    await act(async () => {
      fireEvent.click(slot.view.getByRole('button', { name: '工作台' }))
    })
    expect(slot.view.getByRole('dialog', { name: '控制室' })).toBeTruthy()

    act(() => { locale.setLocale('en') })
    expect(slot.view.getByRole('dialog', { name: 'Control Room' })).toBeTruthy()
    expect(slot.view.queryByRole('dialog', { name: '控制室' })).toBeNull()

    await runtime.dispose()
  })

  it('restores a previously persisted roster', async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      projects: [{
        id: 'p-1', name: 'Alpha', path: 'D:\\alpha', note: 'demo', status: 'active',
        accent: 'violet', done: 3, total: 4, next: 'ship it', createdAt: 1,
      }],
    }))
    const { runtime } = await bench()
    const slot = runtime.renderSlot('sidebar', { collapsed: false, width: 300 })
    await act(async () => {
      fireEvent.click(slot.view.getByRole('button', { name: '工作台' }))
    })
    const dialog = slot.view.getByRole('dialog', { name: '控制室' })
    // The card IS the editor, so its fields arrive as input values.
    expect((slot.view.getByLabelText('项目名称') as HTMLInputElement).value).toBe('Alpha')
    expect((slot.view.getByLabelText('项目目录') as HTMLInputElement).value).toBe('D:\\alpha')
    expect((slot.view.getByLabelText('已完成') as HTMLInputElement).value).toBe('3')
    expect(dialog.textContent).toContain('75%')
    await runtime.dispose()
  })
})
