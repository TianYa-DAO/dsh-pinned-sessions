# dsh-pinned-sessions

> **Found a bug or have a suggestion?** Open an [issue](https://github.com/TianYa-DAO/dsh-pinned-sessions/issues), or email [2842425998@qq.com](mailto:2842425998@qq.com).

Keeps the sessions a user must not lose track of at the top of the DSH Web sidebar workspace list, and lets any session or workspace be pinned there explicitly from its own "..." menu.

English | [中文](README.zh.md)

## What the pinned section holds

In this order, below the region header and above every workspace group:

```
sidebar
├─ Workspaces            ← the region header (search / view options / add workspace)
├─ Pinned                ← added by this plugin
│   ├─ Pinned 2          ← sessions pinned from their "..." menu
│   │   ● Session title…             proj
│   ├─ Running 1         ← derived from session state
│   │   ● Session title…             other
│   ├─ Unread 1
│   ├─ Open now 1
│   └─ Pinned workspaces ← workspaces pinned from their "..." menu
│       ▸ proj  4
├─ Workspace group A     ← a pinned workspace is hidden here
└─ Workspace group B
```

1. **Globally pinned sessions** — chosen from a Session's "..." menu; they stay in their own workspace group below as well. A small chevron on the left of the caption folds this part to its heading (the count stays readable), and while it is folded these Sessions are listed in their state groups again, so folding never hides a running or unread one.
2. **Running / Unread / Open now** — derived from session state:

   | Group | Condition | Marker |
   |---|---|---|
   | Running | session status `running === true` | blue pulsing dot |
   | Unread | session status `completionUnread === true` (finished while you had not opened it) | green dot |
   | Open now | session retained by the main view (`retainedBy.mainView > 0`) | hollow ring |

   A session appears in one of these groups only, in that priority order. A globally pinned session is left out of these groups while the pinned part is expanded — the dot on its row carries the same state — and returns to them while that part is folded.
3. **Globally pinned workspaces** — chosen from a workspace's "..." menu; each renders as a collapsible group whose sessions can be opened right there, and that workspace's own group is hidden from the list below while it is pinned.

Archived sessions and subagent child sessions never appear. Rows are ordered by most recent update, empty parts are omitted, and the whole section stays unrendered when every part is empty. Clicking a row opens that session.

The section renders only while sessions are grouped by workspace (the "By workspace" and "Workspace tree" view options). It hides itself when the sidebar is collapsed to the rail, when the list is switched to "In one list", and while search results are on screen — and while it is hidden, nothing is hidden from the list below either.

## Pinning and unpinning

1. A Session's "..." menu carries **Pin globally / Unpin globally** as a real entry in the shipped `sidebar.workspaces.session.menu.item` slot, alongside the shipped pin, rename, fork and archive rows.
2. A workspace's "..." menu carries the same action. DSH declares no slot for that menu, so the row is portaled into the shipped popup, located from the open row's `data-row-key="workspace:<key>"`.
3. A pinned session row and a pinned workspace header both carry an unpin control that appears on hover — the workspace one matters because its ordinary row is hidden while it is pinned.

The section is inserted at the top of the list's own scroll container, so a long pinned section scrolls together with the workspace groups rather than clipping its own overflow.

## Settings

**Settings → General → Pinned sessions** switches the section off and on. Preferences (the switch, the pinned sessions, the pinned workspaces and which pinned workspaces are collapsed) persist in the shared client store under localStorage key `dsh.pinned-sessions.prefs.v1`.

## Install

From npm:

```sh
dsh plugin add dsh-pinned-sessions
```

From a release tarball:

```sh
dsh plugin add https://github.com/TianYa-DAO/dsh-pinned-sessions/releases/latest/download/dsh-pinned-sessions-0.2.1.tgz
```

In the desktop application, install it from the Plugins page instead. The package declares `dsh.bundle`, so the profile mounts its `cordis.patch.yml` row and the client registry serves `./client.js`. It also declares `engines.dsh` (`>=0.2.0-rc.2 <0.3.0`), so the market shows the host requirement and refuses a version it cannot run.

## How it works

1. It is a client-only plugin: `client.js` loads through the dynamic client module protocol (`window.__ModuleLoader__.load`). Its overlay row registers into the additive `shell.overlay` seat, and that row owns the two portals described below.
2. The sidebar's workspace region (`sidebar.workspaces`) is a single slot with no insertion hole of its own, so the plugin neither replaces nor re-implements the shipped browser. It creates one host element and inserts it at the top of the region's own scrolling list (the element carrying the browser's `list` class, which is the `overflow-y: auto` container), inside `div[data-slot="sidebar.workspaces"]`. The host is removed when the plugin unloads.
3. Placement and mode detection read stable DOM facts: the `listArea` class locates the list area, the `projectRow` and `searchResultRow` row classes distinguish workspace grouping from the flat list and from search, and the `rail` class on the browser root marks the collapsed sidebar. A `MutationObserver` follows structural changes and a 1.5s reconciler covers the region being replaced wholesale.
4. The workspace menu row is portaled into the open menu's popup; the popup is a React portal into `document.body`, and the row it belongs to is found by `data-row-key` plus the open-state class.
5. Data comes from the client's root standard hooks (`useSessions`, `useSessionStatus`, `useWorkspaces`); opening a session goes through `ctx.get("uiWorkspace").openSession(id)`.
6. Styling uses its own `dshps-*` classes and only `--dsw-alias-*` theme tokens, so it follows the active theme and skins. The client half requires only platform modules (`react`, `react-dom`, `@deepseek-ai/dsh-client-store`, `@deepseek-ai/dsh-client-ui-primitives`), so the package has no install-time npm dependencies.

## Self-check

```sh
npm test
```

Loads `client.js` through a stubbed dynamic-module protocol and checks the factory and export shape, all three `apply()` registrations (slot, id, order, shared store, inject face, bilingual dictionaries), the section derivation (priority, archived and subagent filtering, blank sessions, explicit pins, pinned workspaces) and the rendered tree.

## Known limitations

1. Placement depends on the shipped client's DOM and class names (`listArea`, `projectRow`, `searchResultRow`, `rail`, `list`). A sidebar refactor in DSH requires updating the selectors in `client.js`.
2. The workspace "..." menu row is injected because DSH declares no slot for it; a change to that popup's structure requires updating the lookup in `client.js`.
3. Client API renames can break registration; the plugin warns instead of failing silently when `uiWorkspace` is unavailable, but a renamed hook or service still needs a code update.
4. Tested against DSH `0.2.1-rc.1`; `engines.dsh` keeps the range honest about that.

## License

[MIT](LICENSE)
