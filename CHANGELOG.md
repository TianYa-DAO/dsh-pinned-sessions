# Changelog

## [0.2.1] - 2026-10-20

1. A small chevron on the left of the "Pinned" caption folds that part to its heading; the count stays readable and the folded state persists.
2. While that part is folded, its Sessions return to the Running / Unread / Open now groups, so folding never hides a Session that is still working.
3. Declares `engines.dsh` (`>=0.2.0-rc.2 <0.3.0`); the market shows the host requirement from it and refuses an install it cannot run.
4. Runtime hardening: the anchor resolution is cached instead of rescanning the list on every reconcile tick, an unchanged hide rule is no longer rewritten, a stale pin is pruned after a 60s grace, and the injected CSS fails open with a one-shot warning if it ever stops matching.
5. A pinned row's tooltip carries its last activity time.
6. The self-check covers the selector table, the fold toggle and the pin-pruning action.

## [0.2.0] - 2026-10-04

1. A Session's "..." menu gains **Pin globally / Unpin globally**, registered in the shipped `sidebar.workspaces.session.menu.item` list slot (order 450, after Archive).
2. A workspace's "..." menu gains the same action. DSH declares no slot for that menu, so the row is portaled into the shipped popup, located from the open row's `data-row-key="workspace:<key>"`.
3. The pinned section is now three parts, in this order: globally pinned sessions, the derived Running / Unread / Open now groups, then globally pinned workspaces. A globally pinned session is left out of the status groups; the dot on its pinned row carries that state instead.
4. A globally pinned workspace renders as a collapsible group in the pinned section (its sessions are listed and openable there), and its own group is hidden from the list below while it is pinned. Unpinning restores it.
5. A globally pinned session stays in its own workspace group below, as before.
6. The section is inserted at the top of the list's own scroll container, so a long pinned section scrolls together with the workspace groups instead of clipping its own overflow.
7. Pinned sessions, pinned workspaces and collapsed pinned workspaces persist in the shared client store.

## [0.1.0] - 2026-09-30

Initial release.

1. Pinned section above the workspace groups in the DSH Web sidebar, holding running sessions, sessions that finished while unopened, and the session currently open.
2. Group captions (Running / Unread / Open now), per-group counts, and a status marker per row.
3. Settings → General switch backed by a persisted client store.
4. Shown only in the workspace-grouped views; hidden in the collapsed rail, in the flat list, and while search results are on screen.
5. Self-check harness covering the module protocol, both slot registrations, the group derivation and the rendered tree.
