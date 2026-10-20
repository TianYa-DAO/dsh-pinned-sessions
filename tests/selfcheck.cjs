/**
 * Local self-check for this plugin — loads the shipped client source through a
 * stubbed dynamic-module protocol, runs apply() against a fake Cordis ctx, and
 * exercises the section derivation and the rendered tree.
 */
const fs = require('fs')
const vm = require('vm')
const path = require('path')
const assert = require('assert')

const CLIENT = path.join(__dirname, '..', 'client.js')
let source = fs.readFileSync(CLIENT, 'utf8')
source = source.replace(
  'exports.name = "dsh-pinned-sessions";',
  'exports.__debug = { deriveSections: deriveSections, baseName: baseName, toggleIn: toggleIn, cssEscape: cssEscape, PinnedSection: PinnedSection, dotOf: dotOf, SELECTORS: SELECTORS };\n        exports.name = "dsh-pinned-sessions";',
)

let captured = null
const sandbox = {
  console,
  window: { __ModuleLoader__: { load: (options) => { captured = options } }, setInterval: () => 0, clearInterval: () => {} },
  document: {
    querySelector: () => null,
    createElement: () => ({ dataset: {}, setAttribute() {}, appendChild() {} }),
    getElementById: () => null,
    head: { appendChild() {} },
    body: { children: [] },
  },
  MutationObserver: class { observe() {} disconnect() {} },
  KeyboardEvent: class {},
  setInterval: () => 0,
  clearInterval: () => {},
}
sandbox.globalThis = sandbox
vm.createContext(sandbox)
vm.runInContext(source, sandbox, { filename: 'client.js' })

assert.ok(captured !== null, 'module loader entry was not captured')
assert.strictEqual(captured.id, 'dsh-pinned-sessions')

const h = (type, props, ...children) => ({ type, props: props || {}, children })
const fakeReact = {
  createElement: h,
  Fragment: 'Fragment',
  useState: (initial) => [initial, () => {}],
  useEffect: () => {},
  useMemo: (factory) => factory(),
}
const fakeStore = { defineStore: (spec) => ({ spec }) }
const fakePrimitives = {
  MenuItemButton: (props) => h('menuitem-button', props, props.children),
  IconPinFillRegular: (props) => h('pin-fill', props),
  IconPinOutlineRegular: (props) => h('pin-outline', props),
}
const moduleExports = captured.factory((name) => {
  if (name === 'react') return fakeReact
  if (name === 'react-dom') return { createPortal: (children, container, key) => ({ portal: children, container, key }) }
  if (name === '@deepseek-ai/dsh-client-store') return fakeStore
  if (name === '@deepseek-ai/dsh-client-ui-primitives') return fakePrimitives
  throw new Error('unexpected require: ' + name)
})

assert.strictEqual(typeof moduleExports.apply, 'function')
// Arrays built inside the vm realm have a different Array prototype; compare by value.
assert.strictEqual(moduleExports.inject.join(','), 'slots,locale')

// ---- apply() wiring -------------------------------------------------------
const registrations = []
let localeDicts = null
const SLOTS = ['shell.overlay', 'sidebar.workspaces.session.menu.item', 'settings.general.item']
const ctx = {
  effect: (factory) => { factory(); return () => {} },
  locale: { register: (ns, dicts) => { assert.strictEqual(ns, 'pinned-sessions'); localeDicts = dicts; return () => {} } },
  slots: {
    inject: (name, callback) => {
      assert.ok(SLOTS.includes(name), 'unexpected slot ' + name)
      callback()
      return () => {}
    },
    register: (options, component) => { registrations.push({ options, component }); return () => {} },
  },
  get: (name) => (name === 'uiWorkspace' ? { openSession: () => {} } : undefined),
}
moduleExports.apply(ctx)

assert.strictEqual(registrations.length, 3, 'expected three registrations')
const bySlot = (name) => registrations.find(r => r.options.name === name)
const overlay = bySlot('shell.overlay')
const sessionMenu = bySlot('sidebar.workspaces.session.menu.item')
const settings = bySlot('settings.general.item')
assert.ok(overlay && sessionMenu && settings, 'missing registration')
assert.strictEqual(overlay.options.id, 'pinned-sessions')
assert.strictEqual(overlay.options.locale, 'pinned-sessions')
assert.strictEqual(sessionMenu.options.order, 450, 'the menu row sits after the shipped rows (100/200/300/400)')
assert.strictEqual(sessionMenu.options.locale, 'pinned-sessions')
assert.strictEqual(typeof overlay.options.inject, 'function', 'overlay needs the openSession face')
assert.strictEqual(Object.keys(overlay.options.inject()).join(','), 'openSession')
assert.ok(localeDicts && localeDicts.zh && localeDicts.en, 'dictionaries not registered')
const handles = new Set([overlay.options.store, sessionMenu.options.store, settings.options.store])
assert.strictEqual(handles.size, 1, 'all three rows must share one store handle')
assert.ok(overlay.options.store.spec.persist, 'the shared store persists')
assert.strictEqual(typeof overlay.options.store.spec.actions.toggleSession, 'function')
assert.strictEqual(typeof overlay.options.store.spec.actions.toggleWorkspace, 'function')
assert.strictEqual(typeof overlay.options.store.spec.actions.toggleWorkspaceOpen, 'function')
assert.strictEqual(typeof overlay.options.store.spec.actions.pruneSessions, 'function')
const pruned = { pinnedSessions: ['a', 'b', 'c'] }
overlay.options.store.spec.actions.pruneSessions(pruned, ['b'])
assert.strictEqual(pruned.pinnedSessions.join(','), 'a,c', 'a stale pin is dropped and the rest keep their order')
const initial = overlay.options.store.spec.init()
assert.strictEqual(initial.enabled, true)
assert.strictEqual(initial.pinnedSessions.join(','), '')
assert.strictEqual(initial.pinnedWorkspaces.join(','), '')
assert.strictEqual(initial.sessionPinsCollapsed, false, 'the global-pin group starts expanded')
assert.strictEqual(typeof overlay.options.store.spec.actions.toggleSessionPinsCollapsed, 'function')
const pinsDraft = { sessionPinsCollapsed: undefined }
overlay.options.store.spec.actions.toggleSessionPinsCollapsed(pinsDraft)
assert.strictEqual(pinsDraft.sessionPinsCollapsed, true, 'one click collapses the global-pin group')
overlay.options.store.spec.actions.toggleSessionPinsCollapsed(pinsDraft)
assert.strictEqual(pinsDraft.sessionPinsCollapsed, false, 'the next click expands it again')

// ---- derivation -----------------------------------------------------------
const { deriveSections, baseName, toggleIn, cssEscape, PinnedSection, dotOf, SELECTORS } = moduleExports.__debug

// ---- shipped-DOM selectors -------------------------------------------------
assert.strictEqual(SELECTORS.region, '[data-slot="sidebar.workspaces"]', 'the region selector is pinned by test')
assert.strictEqual(SELECTORS.workspaceRow, '[data-row-key^="workspace:"]', 'the workspace row selector is pinned by test')
assert.ok(SELECTORS.scrollerToken.test('_9lTDKa_list'), 'the scroller class token matches a scoped `list` class')
assert.ok(!SELECTORS.scrollerToken.test('_9lTDKa_listArea'), 'the list area is not mistaken for the scroller')
assert.ok(SELECTORS.railToken.test('_9lTDKa_root _9lTDKa_rail'), 'the rail class token matches a scoped `rail` class')
assert.ok(!SELECTORS.railToken.test('_9lTDKa_root'), 'a normal root is not the rail')
const eq = (actual, expected, message) => assert.strictEqual(actual.join('|'), expected.join('|'), message)

const summary = (id, extra) => Object.assign({
  id, displayTitle: 'S-' + id, blank: false, updatedAt: 1000, retainedBy: {}, cwd: 'D:\\ws\\proj',
}, extra)
const list = {
  ids: ['run', 'unread', 'open', 'plain', 'arch', 'sub', 'blankOpen'],
  byId: {
    run: summary('run', { updatedAt: 900 }),
    unread: summary('unread', { updatedAt: 800 }),
    open: summary('open', { updatedAt: 700, retainedBy: { mainView: 1 } }),
    plain: summary('plain', { updatedAt: 600 }),
    arch: summary('arch', { updatedAt: 500 }),
    sub: summary('sub', { updatedAt: 400, origin: 'subagent' }),
    blankOpen: summary('blankOpen', { updatedAt: 300, blank: true, displayTitle: '' }),
  },
}
const statuses = new Map([
  ['run', { running: true, completionUnread: false }],
  ['unread', { running: false, completionUnread: true }],
  ['open', { running: false, completionUnread: false }],
  ['plain', { running: false, completionUnread: false }],
])
const workspaces = {
  items: [
    { workspaceId: 'ws-proj', title: 'proj', path: 'D:\\ws\\proj', sessionIds: ['run', 'unread', 'open', 'plain'] },
    { workspaceId: 'ws-other', title: 'other', path: 'D:\\ws\\other', sessionIds: ['arch', 'sub', 'blankOpen'] },
  ],
  archivedSessionIds: ['arch'],
}

const derived = deriveSections(list, statuses, workspaces, {})
eq(derived.sessionPins.map(r => r.id), [])
eq(derived.statusGroups.map(g => g.key), ['group.running', 'group.unread', 'group.current'])
eq(derived.statusGroups[0].rows.map(r => r.id), ['run'])
eq(derived.statusGroups[1].rows.map(r => r.id), ['unread'])
eq(derived.statusGroups[2].rows.map(r => r.id), ['open'])
eq(derived.workspacePins.map(w => w.key), [])
assert.strictEqual(derived.statusGroups[0].rows[0].dot, 'dshps-dot-running')
assert.strictEqual(derived.statusGroups[1].rows[0].dot, 'dshps-dot-unread')
assert.strictEqual(derived.statusGroups[2].rows[0].dot, 'dshps-dot-current')
assert.strictEqual(derived.statusGroups[0].rows[0].where, 'proj')

// explicit pins: order kept, archived/subagent/unknown members dropped, and a
// pinned Session is left out of the status groups (its own dot carries the state).
const pinned = deriveSections(list, statuses, workspaces, {
  pinnedSessions: ['plain', 'run', 'arch', 'sub', 'gone'],
  pinnedWorkspaces: ['ws-other', 'ws-missing'],
})
eq(pinned.sessionPins.map(r => r.id), ['plain', 'run'])
assert.strictEqual(pinned.sessionPins[1].dot, 'dshps-dot-running', 'a pinned row carries its own state dot')
eq(pinned.statusGroups.map(g => g.key), ['group.unread', 'group.current'], 'pinned Sessions leave the status groups')
eq(pinned.statusGroups[0].rows.map(r => r.id), ['unread'])
eq(pinned.workspacePins.map(w => w.key), ['ws-other'])
assert.strictEqual(pinned.workspacePins[0].title, 'other')
eq(pinned.workspacePins[0].sessions.map(r => r.id), [], 'archived, subagent and non-current blank members are dropped')

// collapsing the explicit pins hands them back to the state groups
const folded = deriveSections(list, statuses, workspaces, {
  pinnedSessions: ['run'],
  sessionPinsCollapsed: true,
})
eq(folded.sessionPins.map(r => r.id), ['run'])
eq(folded.statusGroups[0].rows.map(r => r.id), ['run'], 'a collapsed pin group returns its Sessions to the state groups')
eq(folded.statusGroups.map(g => g.key), ['group.running', 'group.unread', 'group.current'])

// blank Sessions appear only while they are the open one
list.byId.open.retainedBy = {}
list.byId.blankOpen.retainedBy = { mainView: 1 }
const blankCurrent = deriveSections(list, statuses, workspaces, { pinnedWorkspaces: ['ws-other'] })
eq(blankCurrent.workspacePins[0].sessions.map(r => r.id), ['blankOpen'])
assert.strictEqual(blankCurrent.workspacePins[0].sessions[0].blank, true)
list.byId.blankOpen.retainedBy = {}
list.byId.open.retainedBy = { mainView: 1 }

// absent/partial inputs never throw
eq(deriveSections(null, null, null, null).statusGroups, [])
eq(deriveSections({ ids: [], byId: {} }, new Map(), {}, {}).statusGroups, [])
eq(deriveSections(list, statuses, workspaces, { pinnedSessions: null, pinnedWorkspaces: undefined }).sessionPins.map(r => r.id), [])

// ---- helpers --------------------------------------------------------------
assert.strictEqual(baseName('D:\\ws\\proj\\'), 'proj')
assert.strictEqual(baseName('/home/me/proj'), 'proj')
eq(toggleIn(['a', 'b'], 'c'), ['c', 'a', 'b'])
eq(toggleIn(['a', 'b'], 'a'), ['b'])
eq(toggleIn(undefined, 'x'), ['x'])
assert.strictEqual(cssEscape('ws-"quoted"\\path'), 'ws-\\"quoted\\"\\\\path')
assert.strictEqual(dotOf({ running: true }, false), 'dshps-dot-running')
assert.strictEqual(dotOf({ completionUnread: true }, true), 'dshps-dot-unread')
assert.strictEqual(dotOf(undefined, true), 'dshps-dot-current')
assert.strictEqual(dotOf(undefined, false), '')

// ---- presentation ---------------------------------------------------------
const t = (key, params) => (params ? key + ':' + JSON.stringify(params) : key)
const parts = {
  sessionPins: pinned.sessionPins,
  statusGroups: pinned.statusGroups,
  workspacePins: pinned.workspacePins,
}
const tree = PinnedSection({
  parts,
  collapsedWorkspaces: [],
  sessionPinsCollapsed: false,
  toggleSessionPinsCollapsed: () => {},
  t,
  openSession: () => {},
  unpinSession: () => {},
  unpinWorkspace: () => {},
  toggleWorkspaceOpen: () => {},
})
assert.strictEqual(tree.type, 'div')
assert.strictEqual(tree.children[0].children[0], 'heading')
assert.strictEqual(tree.children[1].type.name, 'SessionPinGroup')
const pinGroup = tree.children[1].type(tree.children[1].props)
const pinCaption = pinGroup.children[0]
assert.strictEqual(pinCaption.children[0].props.className, 'dshps-groupToggle dshps-groupToggleOpen', 'the group caption carries the collapse toggle on its left')
assert.strictEqual(pinCaption.children[0].props['aria-expanded'], 'true')
assert.strictEqual(pinCaption.children[1].children[0], 'group.sessionPins')
const pinRows = pinGroup.children[1].map(element => element.type(element.props))
assert.strictEqual(pinRows.length, 2)
assert.strictEqual(pinRows[0].children[1].children[0], 'S-plain')
const pinRow = pinRows[1]
assert.strictEqual(pinRow.props.className, 'dshps-row')
assert.strictEqual(pinRow.children[0].children[0].props.className, 'dshps-dot dshps-dot-running')
assert.strictEqual(pinRow.children[1].children[0], 'S-run')
assert.strictEqual(pinRow.children[3].props.className, 'dshps-action', 'pinned rows carry an unpin control')
const collapsedPins = tree.children[1].type(Object.assign({}, tree.children[1].props, { collapsed: true }))
assert.strictEqual(collapsedPins.children[1], null, 'a collapsed global-pin group renders no rows')
assert.strictEqual(collapsedPins.children[0].children[0].props.className, 'dshps-groupToggle')
assert.strictEqual(collapsedPins.children[0].children[0].props['aria-expanded'], 'false')
assert.strictEqual(collapsedPins.children[0].children[2].children[0], '2', 'the count stays readable while collapsed')
const statusList = tree.children[2]
assert.strictEqual(statusList.length, 2, 'unread and current groups (the pinned running Session left them)')
assert.strictEqual(statusList[0].type.name, 'StatusGroup')
const workspaceSection = tree.children[3]
assert.strictEqual(workspaceSection.props.className, 'dshps-group')
assert.strictEqual(workspaceSection.children[0].children[0].children[0], 'group.workspacePins')
const wsGroupElement = workspaceSection.children[1][0]
const wsGroup = wsGroupElement.type(wsGroupElement.props)
assert.strictEqual(wsGroup.props.className, 'dshps-wsGroup')
const header = wsGroup.children[0]
assert.strictEqual(header.props.role, 'button')
assert.strictEqual(header.props['aria-expanded'], 'true')
assert.strictEqual(header.children[1].children[0], 'other')
assert.strictEqual(header.children[2].children[0], '0')
const wsSessions = wsGroup.children[1]
assert.strictEqual(wsSessions.props.className, 'dshps-wsSessions')
assert.strictEqual(wsSessions.children.length, 1)
// a collapsed pinned workspace renders no session rows
const collapsedGroup = wsGroupElement.type(Object.assign({}, wsGroupElement.props, { collapsed: true }))
assert.strictEqual(collapsedGroup.children[1], null)
assert.strictEqual(PinnedSection({ parts: { sessionPins: [], statusGroups: [], workspacePins: [] }, collapsedWorkspaces: [], t, openSession: () => {} }), null)

console.log('ALL CHECKS PASSED')
