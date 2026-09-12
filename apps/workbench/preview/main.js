/**
 * Preview host: loads the sidebar's built client bundle (the artifact the Host
 * actually serves, which already carries the workbench and its CSS inlined),
 * answers its module-table requires from real vendor ESM files, and mounts the
 * exported `WorkbenchTrigger` in three sidebar contexts.
 */
import ReactDefault, { createElement, Fragment, useEffect, useRef, useState } from 'react'
import JsxRuntime from '/__vendor/jsx-runtime'
import ReactDomClient, { createRoot } from '/__vendor/react-dom-client'
import * as UiSlots from '/__vendor/ui-slots'
import * as ClientStore from '/__vendor/client-store'
import * as UiPrimitives from '/__vendor/ui-primitives'

const STORAGE_KEY = 'dsh.workbench.v1'
const h = createElement

const SEED = {
  version: 1,
  projects: [
    {
      id: 'p-a', name: 'Orion 控制台', path: 'D:\\3_WorkProject\\orion', note: '内部工具的前端重构',
      status: 'active', accent: 'azure', done: 7, total: 12, next: '接入权限矩阵', createdAt: 1,
    },
    {
      id: 'p-b', name: 'Halley 数据管道', path: 'D:\\3_WorkProject\\halley', note: '离线批处理与回填',
      status: 'paused', accent: 'amber', done: 3, total: 9, next: '补回填脚本的幂等性', createdAt: 2,
    },
    {
      id: 'p-c', name: 'Vega 发布器', path: 'D:\\3_WorkProject\\vega', note: '一键出包与灰度',
      status: 'shipped', accent: 'emerald', done: 8, total: 8, next: '待观测', createdAt: 3,
    },
  ],
}

const DICT = {
  zh: {
    trigger: '工作台', title: '控制室', subtitle: '本地项目工作台 · 数据保存在本机浏览器', live: '运行中',
    close: '关闭工作台', 'metrics.label': '实时读数', 'metric.state': '状态', 'metric.state.busy': '进行中',
    'metric.state.ready': '待命', 'metric.progress': '总体进度', 'metric.status': '已交付',
    'metric.status.hint': '个已交付项目', 'metric.clock': '本地时间', 'projects.label': '项目卡片',
    'action.add': '新建项目', 'action.sync': '刷新', 'empty.title': '还没有项目卡片',
    'empty.hint': '新建一张卡片，填上项目目录与下一步，工作台就会开始跟踪它。',
    'card.untitled': '未命名项目', 'card.name': '项目名称', 'card.namePlaceholder': '项目名称',
    'card.path': '项目目录', 'card.pathPlaceholder': 'D:\\path\\to\\project', 'card.note': '项目说明',
    'card.notePlaceholder': '一句话说明这个项目做什么', 'card.progress': '完成进度', 'card.done': '已完成',
    'card.total': '总数', 'card.next': '下一步', 'card.nextPlaceholder': '下一个要推进的动作',
    'card.status': '项目状态', 'card.accent': '卡片配色', 'card.remove': '删除卡片',
    'status.active': '进行中', 'status.paused': '暂停', 'status.shipped': '已交付', 'status.archived': '已归档',
    'accent.azure': '天蓝', 'accent.violet': '紫罗兰', 'accent.amber': '琥珀', 'accent.emerald': '翡翠',
    'accent.rose': '玫瑰', 'accent.slate': '石墨',
    'foot.hint': '卡片数据保存在本机浏览器（localStorage），不写入会话日志。',
  },
  en: {
    trigger: 'Workbench', title: 'Control Room', subtitle: 'Local project workbench · data stays in this browser',
    live: 'Live', close: 'Close workbench', 'metrics.label': 'Live readings', 'metric.state': 'State',
    'metric.state.busy': 'In flight', 'metric.state.ready': 'Standby', 'metric.progress': 'Overall progress',
    'metric.status': 'Delivered', 'metric.status.hint': 'projects shipped', 'metric.clock': 'Local time',
    'projects.label': 'Project cards', 'action.add': 'New project', 'action.sync': 'Refresh',
    'empty.title': 'No project cards yet',
    'empty.hint': 'Create a card, give it a directory and a next step, and the workbench starts tracking it.',
    'card.untitled': 'Untitled project', 'card.name': 'Project name', 'card.namePlaceholder': 'Project name',
    'card.path': 'Project directory', 'card.pathPlaceholder': 'D:\\path\\to\\project', 'card.note': 'Project note',
    'card.notePlaceholder': 'One line on what this project is', 'card.progress': 'Completion', 'card.done': 'Done',
    'card.total': 'Total', 'card.next': 'Next', 'card.nextPlaceholder': 'The next action to push',
    'card.status': 'Project status', 'card.accent': 'Card accent', 'card.remove': 'Remove card',
    'status.active': 'Active', 'status.paused': 'Paused', 'status.shipped': 'Shipped', 'status.archived': 'Archived',
    'accent.azure': 'Azure', 'accent.violet': 'Violet', 'accent.amber': 'Amber', 'accent.emerald': 'Emerald',
    'accent.rose': 'Rose', 'accent.slate': 'Slate',
    'foot.hint': 'Cards persist in this browser (localStorage); nothing is written to the session log.',
  },
}

const MODULES = new Map([
  ['react', ReactDefault],
  ['react/jsx-runtime', JsxRuntime],
  ['react-dom', ReactDomClient],
  ['react-dom/client', ReactDomClient],
  ['@deepseek-ai/dsh-client-store', ClientStore],
  ['@deepseek-ai/dsh-client-ui-slots', UiSlots],
  ['@deepseek-ai/dsh-client-ui-primitives', UiPrimitives],
])

let registration = null
window.__ModuleLoader__ = {
  load(value) { registration = value },
  create() { return undefined },
  require(id) {
    if (!MODULES.has(id)) throw new Error(`preview module table has no ${id}`)
    return MODULES.get(id)
  },
}

const status = document.getElementById('status')

const frame = (title, caption, node) => h('section', { className: 'frame' },
  h('header', { className: 'frameHead' },
    h('h2', { className: 'frameTitle' }, title),
    h('p', { className: 'frameCaption' }, caption)),
  h('div', { className: 'frameBody' }, node))

const Rail = ({ label }) => h('div', { className: 'rail' },
  h('span', { className: 'railBrand' }),
  h('span', { className: 'railPill' }, label),
  h('span', { className: 'railFoot' }, '⚙'))

/** One sidebar frame: seeds the roster, then optionally opens the control room. */
function Frame({ wide, locale, label, caption, seed, autoOpen }) {
  const host = useRef(null)
  const [Trigger, setTrigger] = useState(null)

  useEffect(() => {
    let cancelled = false
    void loadTrigger().then((component) => { if (!cancelled) setTrigger(() => component) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (Trigger === null || !autoOpen) return
    // The roster must be in storage BEFORE the trigger's first render, so the
    // seeding happens once at module scope and this effect only opens the room.
    const timer = window.setTimeout(() => {
      host.current?.querySelector('button[aria-haspopup="dialog"]')?.click()
    }, 80)
    return () => { window.clearTimeout(timer) }
  }, [Trigger, autoOpen])

  const dict = DICT[locale]
  return frame(label, caption, h('div', {
    className: `sidebar ${wide ? 'wide' : 'narrow'}`, ref: host,
  },
  wide
    ? h('div', { className: 'mockList' }, h('span'), h('span'), h('span'))
    : h(Rail, { label: locale === 'zh' ? '新建' : 'New' }),
  Trigger === null
    ? h('span', {}, '加载中…')
    : h(Trigger, { wide, wt: (key) => dict[key] ?? key }),
  h('span', { className: 'mockSettings' }, locale === 'zh' ? '设置' : 'Settings')))
}

let triggerPromise
function loadTrigger() {
  triggerPromise ??= import('/plugins/client.js').then(() => {
    const exports = registration?.factory?.(window.__ModuleLoader__.require)
    if (exports?.WorkbenchTrigger === undefined) throw new Error('the bundle did not export WorkbenchTrigger')
    return exports.WorkbenchTrigger
  })
  return triggerPromise
}

// The roster must exist before the first render: the trigger reads storage in
// its state initializer, so seeding after mount would show an empty room.
window.localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED))

void loadTrigger().then(() => {
  status.textContent = '已从 lib/client.js 载入插件产物：factory 执行成功，导出 WorkbenchTrigger。'
  createRoot(document.getElementById('root')).render(
    h(Fragment, null,
      h(Frame, {
        wide: false, locale: 'zh', label: '折叠态 · 侧边栏底部入口',
        caption: 'Rail trigger — 36×36，与设置按钮同高', seed: false, autoOpen: false,
      }),
      h(Frame, {
        wide: true, locale: 'zh', label: '展开态 · 空工作台',
        caption: 'Expanded foot row；点开是控制室空状态', seed: false, autoOpen: false,
      }),
      h(Frame, {
        wide: true, locale: 'en', label: '展开态 · 已有项目（English copy）',
        caption: 'Roster seeded — 自动打开控制室，含 3 张示例卡片', seed: true, autoOpen: true,
      })),
  )
}).catch((error) => {
  status.textContent = `加载失败：${String(error?.message ?? error)}`
  console.error(error)
})
