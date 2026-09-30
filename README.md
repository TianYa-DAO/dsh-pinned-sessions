# dsh-pinned-sessions

Keeps **running**, **finished-but-unopened** and **currently open** sessions pinned to the top of the DSH Web sidebar — below the workspace section header and above every workspace group.

This is not the built-in manual pin, which only front-loads a session inside its own workspace group. It is a separate section driven by session state, and the sessions it lists stay in their own workspace group as well.

English | [中文](README.zh.md)

## Where it appears

```
sidebar
├─ Workspaces        ← the region header (search / view options / add workspace)
├─ Pinned            ← added by this plugin
│   ├─ Running 1
│   │   ● Session title…             proj
│   ├─ Unread 1
│   │   ● Session title…             other
│   └─ Open now 1
│       ● Session title…
├─ Workspace group A
└─ Workspace group B
```

It renders only while sessions are grouped by workspace (the "By workspace" and "Workspace tree" view options). It hides itself when the sidebar is collapsed to the rail, when the list is switched to "In one list", and while search results are on screen.

## Grouping rules

| Group | Condition | Marker |
|---|---|---|
| Running | session status `running === true` | blue pulsing dot |
| Unread | session status `completionUnread === true` (finished while you had not opened it) | green dot |
| Open now | session retained by the main view (`retainedBy.mainView > 0`) | hollow ring |

1. A session appears in exactly one group; the order is Running, then Unread, then Open now.
2. Archived sessions and subagent child sessions never appear.
3. Rows are ordered by most recent update, empty groups are omitted, and the whole section stays unrendered when all three groups are empty.
4. Clicking a row opens that session, the same action the sidebar row performs.

## Settings

**Settings → General → Pinned sessions** switches the section off and on. The preference is persisted by the shared client store (localStorage key `dsh.pinned-sessions.prefs.v1`).

## Install

From npm:

```sh
dsh plugin add dsh-pinned-sessions
```

From a release tarball:

```sh
dsh plugin add https://github.com/TianYa-DAO/dsh-pinned-sessions/releases/latest/download/dsh-pinned-sessions-0.1.0.tgz
```

In the desktop application, install it from the Plugins page instead. The package declares `dsh.bundle`, so the profile mounts its `cordis.patch.yml` row and the client registry serves `./client.js`; the client half is picked up without restarting when the host row is already mounted.

## How it works

1. It is a client-only plugin: `client.js` loads through the dynamic client module protocol (`window.__ModuleLoader__.load`) and registers into the additive `shell.overlay` seat, which is where its React portal lives.
2. The sidebar's workspace region (`sidebar.workspaces`) is a single slot with no insertion hole of its own, so the plugin neither replaces nor re-implements the shipped browser. It creates one host element and inserts it between the region's own section header and its session list, inside `div[data-slot="sidebar.workspaces"]`. The host is an ordinary child of the browser root's flex column, it takes its natural height, and it is removed when the plugin unloads.
3. Placement and mode detection read stable DOM facts: the `listArea` class locates the list, the `projectRow` and `searchResultRow` row classes distinguish workspace grouping from the flat list and from search, and the `rail` class on the browser root marks the collapsed sidebar. A `MutationObserver` follows structural changes and a 1.5s reconciler covers the region being replaced wholesale.
4. Data comes from the client's root standard hooks (`useSessions`, `useSessionStatus`, `useWorkspaces`); opening a session goes through `ctx.get("uiWorkspace").openSession(id)`.
5. Styling uses its own `dshps-*` classes and only `--dsw-alias-*` theme tokens, so it follows the active theme and skins. The client half requires only platform modules (`react`, `react-dom`, `@deepseek-ai/dsh-client-store`), so the package has no install-time npm dependencies.

## Self-check

```sh
npm test
```

Loads `client.js` through a stubbed dynamic-module protocol and checks the factory and export shape, both `apply()` registrations (slot, id, order, shared store, inject face, bilingual dictionaries), the group derivation (priority, archived and subagent filtering, recency order, empty-group omission, blank sessions), and the rendered tree.

## Known limitations

1. Placement depends on the shipped client's DOM and class names (`listArea`, `projectRow`, `searchResultRow`, `rail`). A sidebar refactor in DSH requires updating the selectors in `client.js`.
2. Client API renames can break registration; the plugin warns instead of failing silently when `uiWorkspace` is unavailable, but a renamed hook or service still needs a code update.
3. Tested against DSH `0.2.0-rc.2`.

## License

[MIT](LICENSE)
