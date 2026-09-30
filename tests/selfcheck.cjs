/**
 * Local self-check for this plugin — loads the shipped client source through a
 * stubbed dynamic-module protocol, runs apply() against a fake Cordis ctx, and
 * exercises the group derivation and the rendered tree.
 */
const fs = require('fs')
const vm = require('vm')
const path = require('path')
const assert = require('assert')

const CLIENT = path.join(__dirname, '..', 'client.js')
let source = fs.readFileSync(CLIENT, 'utf8')
source = source.replace(
  'exports.name = "dsh-pinned-sessions";',
  'exports.__debug = { deriveGroups: deriveGroups, baseName: baseName, PinnedSection: PinnedSection };\n        exports.name = "dsh-pinned-sessions";',
)

let captured = null
const sandbox = {
  console,
  window: { __ModuleLoader__: { load: (options) => { captured = options } } },
}
sandbox.globalThis = sandbox
vm.createContext(sandbox)
vm.runInContext(source, sandbox, { filename: 'client.js' })

assert.ok(captured !== null, 'module loader entry was not captured')
assert.strictEqual(captured.id, 'dsh-pinned-sessions')

const h = (type, props, ...children) => ({ type, props: props || {}, children })
const fakeReact = {
  createElement: h,
  useState: (initial) => [initial, () => {}],
  useEffect: () => {},
  useMemo: (factory) => factory(),
}
const fakeStore = { defineStore: (spec) => ({ spec }) }
const moduleExports = captured.factory((name) => {
  if (name === 'react') return fakeReact
  if (name === 'react-dom') return { createPortal: (children) => ({ portal: children }) }
  if (name === '@deepseek-ai/dsh-client-store') return fakeStore
  throw new Error('unexpected require: ' + name)
})

assert.strictEqual(typeof moduleExports.apply, 'function')
// Arrays built inside the vm realm have a different Array prototype; compare by value.
assert.strictEqual(moduleExports.inject.join(','), 'slots,locale')

// ---- apply() wiring -------------------------------------------------------
const registrations = []
let localeDicts = null
const ctx = {
  effect: (factory) => { factory(); return () => {} },
  locale: { register: (ns, dicts) => { assert.strictEqual(ns, 'pinned-sessions'); localeDicts = dicts; return () => {} } },
  slots: {
    inject: (name, callback) => {
      assert.ok(name === 'shell.overlay' || name === 'settings.general.item', 'unexpected slot ' + name)
      callback()
      return () => {}
    },
    register: (options, component) => { registrations.push({ options, component }); return () => {} },
  },
  get: (name) => (name === 'uiWorkspace' ? { openSession: () => {} } : undefined),
}
moduleExports.apply(ctx)

assert.strictEqual(registrations.length, 2, 'expected two registrations')
const overlay = registrations.find(r => r.options.name === 'shell.overlay')
const settings = registrations.find(r => r.options.name === 'settings.general.item')
assert.ok(overlay && settings, 'missing registration')
assert.strictEqual(overlay.options.id, 'pinned-sessions')
assert.strictEqual(overlay.options.locale, 'pinned-sessions')
assert.strictEqual(typeof overlay.options.store, 'object')
assert.strictEqual(overlay.options.store, settings.options.store, 'both rows must share one store handle')
assert.strictEqual(typeof overlay.options.inject, 'function', 'overlay needs the openSession face')
assert.deepStrictEqual(Object.keys(overlay.options.inject()), ['openSession'])
assert.strictEqual(overlay.component, moduleExports.__debug ? overlay.component : overlay.component)
assert.ok(localeDicts && localeDicts.zh && localeDicts.en, 'dictionaries not registered')

// ---- derivation -----------------------------------------------------------
const { deriveGroups } = moduleExports.__debug
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
// `open` is the Session retained by the main view (the only mainView retainer).
const workspaces = {
  items: [
    { title: 'proj', path: 'D:\\ws\\proj', sessionIds: ['run', 'unread', 'open', 'plain'] },
    { title: '', path: 'D:\\ws\\other', sessionIds: ['arch', 'sub', 'blankOpen'] },
  ],
  archivedSessionIds: ['arch'],
}

const eq = (actual, expected, message) => assert.strictEqual(actual.join('|'), expected.join('|'), message)
const groups = deriveGroups(list, statuses, workspaces)
eq(groups.map(g => g.key), ['group.running', 'group.unread', 'group.current'])
eq(groups[0].rows.map(r => r.id), ['run'])
eq(groups[1].rows.map(r => r.id), ['unread'])
eq(groups[2].rows.map(r => r.id), ['open'], 'the main-view Session is the current one')
eq(groups[0].rows.map(r => r.id), ['run'], 'archived and subagent Sessions never appear')
assert.strictEqual(groups[0].rows[0].where, 'proj')
assert.strictEqual(groups[2].rows[0].where, 'proj')

// a current blank Session still shows, with the blank flag for the renderer
list.byId.open.retainedBy = {}
list.byId.blankOpen.retainedBy = { mainView: 1 }
const blankCurrent = deriveGroups(list, statuses, workspaces)
eq(blankCurrent.map(g => g.key), ['group.running', 'group.unread', 'group.current'])
eq(blankCurrent[2].rows.map(r => r.id), ['blankOpen'])
assert.strictEqual(blankCurrent[2].rows[0].blank, true)
assert.strictEqual(blankCurrent[2].rows[0].where, 'other')

// recency ordering inside one group, and empty groups omitted
list.byId.blankOpen.retainedBy = {}
statuses.set('plain', { running: true, completionUnread: false })
const ordered = deriveGroups(list, statuses, workspaces)
eq(ordered.map(g => g.key), ['group.running', 'group.unread'])
eq(ordered[0].rows.map(r => r.id), ['run', 'plain'], 'newer updatedAt first')
eq(ordered[0].rows.map(r => r.title), ['S-run', 'S-plain'])
statuses.delete('plain')

// absent/partial inputs never throw
eq(deriveGroups(null, null, null), [])
eq(deriveGroups({ ids: [], byId: {} }, new Map(), {}), [])

// ---- presentation ---------------------------------------------------------
const { PinnedSection, baseName } = moduleExports.__debug
assert.strictEqual(baseName('D:\\ws\\proj\\'), 'proj')
assert.strictEqual(baseName('/home/me/proj'), 'proj')
const t = (key, params) => (params ? key + ':' + JSON.stringify(params) : key)
const tree = PinnedSection({ groups, t, openSession: () => {} })
assert.strictEqual(tree.type, 'div')
assert.strictEqual(tree.children.length, 2, 'heading + one mapped group list')
assert.strictEqual(tree.children[0].children[0], 'heading')
const groupList = tree.children[1]
assert.strictEqual(groupList.length, 3, 'three pinned groups')
// Function components are invoked directly: the fake createElement does not render them.
const firstGroup = groupList[0].type(groupList[0].props)
assert.strictEqual(firstGroup.props.className, 'dshps-group')
const caption = firstGroup.children[0]
assert.strictEqual(caption.children[0].children[0], 'group.running')
assert.strictEqual(caption.children[1].children[0], '1')
const row = firstGroup.children[1][0].type(firstGroup.children[1][0].props)
assert.strictEqual(row.type, 'button')
assert.strictEqual(row.props.className, 'dshps-row')
assert.strictEqual(row.children[0].props.className, 'dshps-dotCell')
assert.strictEqual(row.children[0].children[0].props.className, 'dshps-dot dshps-dot-running')
assert.strictEqual(row.children[1].children[0], 'S-run')
assert.strictEqual(row.children[2].children[0], 'proj')
assert.strictEqual(row.props.title, 'S-run · proj')
const blankTree = PinnedSection({ groups: blankCurrent, t, openSession: () => {} })
const blankGroupElement = blankTree.children[1][2]
const blankRowElement = blankGroupElement.type(blankGroupElement.props).children[1][0]
const blankRow = blankRowElement.type(blankRowElement.props)
assert.strictEqual(blankRow.children[1].children[0], 'session.blank', 'blank Sessions fall back to the localized label')
assert.strictEqual(PinnedSection({ groups: [], t, openSession: () => {} }), null)

console.log('ALL CHECKS PASSED')

