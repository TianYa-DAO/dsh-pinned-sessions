/**
 * dsh-pinned-sessions — client half.
 *
 * Adds a pinned section at the top of the sidebar's workspace browsing region
 * (below the region header, above every workspace group) with three parts, in
 * this order:
 *
 *   1. globally pinned Sessions   (chosen from a Session's "..." menu)
 *   2. running / finished-unopened / currently open  (derived from state)
 *   3. globally pinned workspaces (chosen from a workspace's "..." menu; the
 *      workspace's own group in the list below is hidden while it is pinned)
 *
 * Placement: the sidebar's workspace region has no insertion hole of its own,
 * so this plugin renders through the additive `shell.overlay` seat and portals
 * its content into a host element this plugin owns, inserted at the top of the
 * region's own scrolling session list. The section therefore shares that list's
 * scroll region (a long pinned section scrolls with the workspace groups rather
 * than clipping itself), takes its natural height, and is removed with the
 * plugin fiber. The shipped browser is never replaced or re-implemented.
 *
 * The section appears only while the region shows workspace groups: it hides in
 * rail (collapsed sidebar) state, in the flat "one list" grouping, and while
 * search results are on screen — and while it is hidden nothing is hidden from
 * the list below either.
 *
 * Two extension paths are used, because DSH offers them at different levels:
 *
 *   - a Session's "..." menu is an official list slot
 *     (`sidebar.workspaces.session.menu.item`), so its row is a real slot
 *     entry rendered with the shipped `MenuItemButton`;
 *   - a workspace's "..." menu has no slot, so that row is portaled into the
 *     open menu's own popup (identified from the row carrying
 *     `data-row-key="workspace:<key>"` and the open-state class), which is the
 *     only way a plugin can add a row there without replacing the browser.
 *
 * 设置 → 通用 carries the on/off switch; preferences are persisted by the
 * shared Client store.
 */
(() => {
  try {
    window.__ModuleLoader__.load({
      id: "dsh-pinned-sessions",
      factory: (require) => {
        var module = { exports: {} };
        var exports = module.exports;
        Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

        var react = require("react");
        var reactDom = require("react-dom");
        var clientStore = require("@deepseek-ai/dsh-client-store");
        var ui = (function () {
          try { return require("@deepseek-ai/dsh-client-ui-primitives"); } catch (error) { return {}; }
        })();

        var NS = "pinned-sessions";
        var h = react.createElement;
        var STYLE_ID = "dsh-pinned-sessions/pinned.css";
        var HIDE_STYLE_ID = "dsh-pinned-sessions/hide.css";
        var HOST_ATTR = "data-dsh-pinned-sessions";
        var MENU_HOST_ATTR = "data-dsh-pinned-sessions-menu";
        var RECONCILE_MS = 1500;
        var WORKSPACE_ROW_PREFIX = "workspace:";
        var SESSION_ROW_PREFIX = "session:";
        var GLOBAL_PIN_ORDER = 450;

        var MenuItemButton = ui.MenuItemButton;
        var IconPinFill = ui.IconPinFillRegular;
        var IconPinOutline = ui.IconPinOutlineRegular;

        var CSS = [
          ".dshps-host{box-sizing:border-box;flex:none;padding-bottom:6px;margin-bottom:2px;border-bottom:.5px solid var(--dsw-alias-border-l2)}",
          ".dshps-heading{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;padding:2px 8px;letter-spacing:.02em}",
          ".dshps-group{padding-top:2px}",
          ".dshps-groupTitle{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;padding:2px 8px 2px 28px;display:flex;align-items:center;gap:6px}",
          ".dshps-count{color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}",
          ".dshps-row{box-sizing:border-box;width:100%;height:32px;padding:0 8px;border:0;background:transparent;border-radius:var(--dsw-radius-md,8px);color:var(--dsw-alias-label-primary);font-family:inherit;font-size:14px;line-height:20px;text-align:left;cursor:pointer;user-select:none;display:flex;align-items:center;gap:0}",
          ".dshps-row:hover{background:var(--dsw-alias-interactive-bg-hover)}",
          ".dshps-row:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}",
          ".dshps-dotCell{width:16px;height:20px;flex:none;display:inline-flex;align-items:center;justify-content:center}",
          ".dshps-dot{width:7px;height:7px;border-radius:50%;flex:none;background:var(--dsw-alias-label-tertiary)}",
          ".dshps-dot-running{background:var(--dsw-alias-state-business-primary,#4d6bfe);animation:dshps-pulse 1.4s ease-in-out infinite}",
          ".dshps-dot-unread{background:var(--dsw-alias-state-success-primary,#12b76a)}",
          ".dshps-dot-current{background:transparent;box-shadow:inset 0 0 0 2px var(--dsw-alias-label-secondary)}",
          "@keyframes dshps-pulse{0%,100%{opacity:1}50%{opacity:.3}}",
          ".dshps-title{flex:1;min-width:0;margin:0 6px 0 4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
          ".dshps-titleButton{background:transparent;border:0;padding:0;color:inherit;font:inherit;text-align:left;cursor:pointer}",
          ".dshps-where{flex:none;max-width:42%;margin-left:6px;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
          ".dshps-action{width:20px;height:20px;flex:none;margin-left:4px;padding:0;border:0;border-radius:var(--dsw-radius-sm,4px);background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;font-size:12px;line-height:20px;opacity:0}",
          ".dshps-row:hover .dshps-action,.dshps-wsHeader:hover .dshps-action,.dshps-action:focus-visible{opacity:1}",
          ".dshps-action:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}",
          ".dshps-wsGroup{padding-top:2px}",
          ".dshps-wsHeader{box-sizing:border-box;width:100%;height:32px;padding:0 8px;border:0;background:transparent;border-radius:var(--dsw-radius-md,8px);color:var(--dsw-alias-label-primary);font-family:inherit;font-size:14px;line-height:20px;text-align:left;cursor:pointer;user-select:none;display:flex;align-items:center;gap:0}",
          ".dshps-wsHeader:hover{background:var(--dsw-alias-interactive-bg-hover)}",
          ".dshps-wsHeader:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}",
          ".dshps-chevron{width:16px;height:20px;flex:none;display:inline-flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-tertiary);font-size:11px;transition:transform .12s ease}",
          ".dshps-chevronOpen{transform:rotate(90deg)}",
          ".dshps-wsTitle{flex:1;min-width:0;margin:0 6px 0 4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
          ".dshps-wsSessions{padding-left:0}",
          ".dshps-setRow{border-bottom:.5px solid var(--dsw-alias-border-l2);justify-content:space-between;align-items:center;gap:24px;padding:16px 0;display:flex}",
          ".dshps-setTitle{font-size:14px;line-height:20px}",
          ".dshps-setDesc{color:var(--dsw-alias-label-secondary);margin-top:4px;font-size:12px;line-height:18px}",
          ".dshps-switch{position:relative;width:34px;height:20px;flex:none;padding:0;border:0;border-radius:10px;cursor:pointer;background:var(--dsw-alias-border-l2);transition:background .15s ease}",
          ".dshps-switch[aria-checked=\"true\"]{background:var(--dsw-alias-state-business-primary,#4d6bfe)}",
          ".dshps-switch:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}",
          ".dshps-knob{position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .15s ease}",
          ".dshps-switch[aria-checked=\"true\"] .dshps-knob{transform:translateX(14px)}",
        ].join("");

        var ZH = {
          "heading": "置顶",
          "group.sessionPins": "全局置顶",
          "group.running": "进行中",
          "group.unread": "待查看",
          "group.current": "当前打开",
          "group.workspacePins": "置顶工作区",
          "session.blank": "新会话",
          "row.open": "打开会话 {name}",
          "workspace.expand": "展开 {name}",
          "workspace.collapse": "折叠 {name}",
          "menu.pinGlobal": "全局置顶",
          "menu.unpinGlobal": "取消全局置顶",
          "action.unpin": "取消全局置顶",
          "settings.title": "置顶会话区",
          "settings.description": "在侧栏工作区列表顶部固定「运行中 / 跑完未点开 / 当前打开」的会话，以及从「...」菜单里全局置顶的会话与工作区。仅在按工作区分组时显示。",
        };
        var EN = {
          "heading": "Pinned",
          "group.sessionPins": "Pinned",
          "group.running": "Running",
          "group.unread": "Unread",
          "group.current": "Open now",
          "group.workspacePins": "Pinned workspaces",
          "session.blank": "New session",
          "row.open": "Open session {name}",
          "workspace.expand": "Expand {name}",
          "workspace.collapse": "Collapse {name}",
          "menu.pinGlobal": "Pin globally",
          "menu.unpinGlobal": "Unpin globally",
          "action.unpin": "Unpin globally",
          "settings.title": "Pinned sessions",
          "settings.description": "Keeps running, finished-but-unopened and currently open sessions at the top of the sidebar workspace list, together with the sessions and workspaces pinned from their \"...\" menu. Shown only while sessions are grouped by workspace.",
        };

        function installCss() {
          if (typeof document === "undefined") return;
          if (document.querySelector("style[data-plugin-css=" + JSON.stringify(STYLE_ID) + "]") !== null) return;
          var tag = document.createElement("style");
          tag.dataset.plugin = "dsh-pinned-sessions";
          tag.dataset.pluginCss = STYLE_ID;
          tag.textContent = CSS;
          document.head.appendChild(tag);
        }
        installCss();

        /** Last path segment of a Host directory spelling, for the trailing label. */
        function baseName(path) {
          if (typeof path !== "string" || path === "") return "";
          var parts = path.replace(/[\\/]+$/, "").split(/[\\/]/);
          return parts.length === 0 ? path : parts[parts.length - 1];
        }

        /** Descending recency, with the Session id as a deterministic tie-break. */
        function byRecency(left, right) {
          if (left.updatedAt !== right.updatedAt) return right.updatedAt - left.updatedAt;
          return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
        }

        /** Immutable membership toggle; a non-array input (older persisted state) reads as empty. */
        function toggleIn(value, key) {
          var list = Array.isArray(value) ? value : [];
          return list.indexOf(key) >= 0 ? list.filter(item => item !== key) : [key].concat(list);
        }

        /** Escape a value for a quoted CSS attribute selector. */
        function cssEscape(value) {
          return String(value).replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
        }

        /** Read a list off the store snapshot, tolerating older persisted shapes. */
        function listOf(value) {
          return Array.isArray(value) ? value : [];
        }

        /** The dot a row shows for its own state. */
        function dotOf(status, isCurrent) {
          if (status && status.running === true) return "dshps-dot-running";
          if (status && status.completionUnread === true) return "dshps-dot-unread";
          if (isCurrent) return "dshps-dot-current";
          return "";
        }

        /**
         * Fold the Session list, status and Workspace snapshots into the three
         * pinned parts. Status groups never dedupe against the explicit pins: a
         * globally pinned Session that is also running appears in both, which is
         * what "keep the status groups as they are" means here.
         */
        function deriveSections(list, statuses, workspaceState, prefs) {
          var empty = { sessionPins: [], statusGroups: [], workspacePins: [] };
          if (!list || !Array.isArray(list.ids) || !list.byId) return empty;
          var archived = {};
          var archivedIds = workspaceState && workspaceState.archivedSessionIds;
          if (Array.isArray(archivedIds)) {
            for (var a = 0; a < archivedIds.length; a++) archived[archivedIds[a]] = true;
          }
          var items = workspaceState && Array.isArray(workspaceState.items) ? workspaceState.items : [];
          var whereBySession = {};
          for (var w = 0; w < items.length; w++) {
            var item = items[w];
            var members = item && item.sessionIds;
            if (!Array.isArray(members)) continue;
            var label = (item.title && String(item.title)) || baseName(item.path);
            for (var m = 0; m < members.length; m++) {
              if (whereBySession[members[m]] === undefined) whereBySession[members[m]] = label;
            }
          }
          var currentId = null;
          for (var c = 0; c < list.ids.length; c++) {
            var candidate = list.byId[list.ids[c]];
            if (candidate && candidate.retainedBy && (candidate.retainedBy.mainView || 0) > 0) {
              currentId = list.ids[c];
              break;
            }
          }
          /** One renderable row, or null when the Session must not be listed here. */
          var rowOf = (id) => {
            var session = list.byId[id];
            if (!session || archived[id] === true || session.origin === "subagent") return null;
            // Only the open provisional Session is a row; other blank placeholders are not.
            if (session.blank === true && id !== currentId) return null;
            var status = statuses && typeof statuses.get === "function" ? statuses.get(id) : undefined;
            return {
              id: id,
              title: typeof session.displayTitle === "string" ? session.displayTitle : "",
              blank: session.blank === true,
              updatedAt: typeof session.updatedAt === "number" ? session.updatedAt : 0,
              where: whereBySession[id] || baseName(session.cwd),
              dot: dotOf(status, id === currentId),
            };
          };

          var sessionPins = [];
          var pinnedSessions = listOf(prefs && prefs.pinnedSessions);
          for (var p = 0; p < pinnedSessions.length; p++) {
            var pinnedRow = rowOf(pinnedSessions[p]);
            if (pinnedRow !== null) sessionPins.push(pinnedRow);
          }
          // A globally pinned Session is listed once, at the top; its state is the
          // dot on that row, so the status groups below must not repeat it.
          var pinnedIds = {};
          for (var q = 0; q < sessionPins.length; q++) pinnedIds[sessionPins[q].id] = true;

          var running = [];
          var unread = [];
          var current = [];
          for (var i = 0; i < list.ids.length; i++) {
            var id = list.ids[i];
            if (pinnedIds[id] === true) continue;
            var row = rowOf(id);
            if (row === null) continue;
            var state = statuses && typeof statuses.get === "function" ? statuses.get(id) : undefined;
            if (state && state.running === true) running.push(row);
            else if (state && state.completionUnread === true) unread.push(row);
            else if (id === currentId) current.push(row);
          }
          var statusGroups = [];
          var buckets = [
            { key: "group.running", rows: running },
            { key: "group.unread", rows: unread },
            { key: "group.current", rows: current },
          ];
          for (var g = 0; g < buckets.length; g++) {
            if (buckets[g].rows.length === 0) continue;
            buckets[g].rows.sort(byRecency);
            statusGroups.push(buckets[g]);
          }

          var workspacePins = [];
          var pinnedWorkspaces = listOf(prefs && prefs.pinnedWorkspaces);
          for (var k = 0; k < pinnedWorkspaces.length; k++) {
            var key = pinnedWorkspaces[k];
            var workspace = null;
            for (var s = 0; s < items.length; s++) {
              if (items[s] && items[s].workspaceId === key) { workspace = items[s]; break; }
            }
            if (workspace === null) continue;
            var rows = [];
            var memberIds = Array.isArray(workspace.sessionIds) ? workspace.sessionIds : [];
            for (var n = 0; n < memberIds.length; n++) {
              var memberRow = rowOf(memberIds[n]);
              if (memberRow !== null) rows.push(memberRow);
            }
            rows.sort(byRecency);
            workspacePins.push({
              key: key,
              title: (workspace.title && String(workspace.title)) || baseName(workspace.path) || key,
              sessions: rows,
            });
          }

          return { sessionPins: sessionPins, statusGroups: statusGroups, workspacePins: workspacePins };
        }

        /**
         * Own the host element between the region's section header and its list.
         * Returns the element to portal into, or null while the section must not
         * render (feature off, region absent, rail state, flat grouping, search).
         */
        function useAnchorHost(active) {
          var pair = react.useState(null);
          var host = pair[0];
          var setHost = pair[1];
          react.useEffect(() => {
            if (!active) return undefined;
            var node = document.createElement("div");
            node.className = "dshps-host";
            node.setAttribute(HOST_ATTR, "");
            var attached = false;
            var disposed = false;
            var observer = null;
            var watchedRegion = null;
            var watchedRoot = null;

            var detach = () => {
              if (node.parentNode !== null) node.parentNode.removeChild(node);
              if (attached) {
                attached = false;
                setHost(null);
              }
            };
            var listAreaOf = (root) => {
              for (var i = 0; i < root.children.length; i++) {
                var child = root.children[i];
                if (typeof child.className === "string" && child.className.indexOf("listArea") >= 0) return child;
              }
              return null;
            };
            /**
             * The scrolling rows container inside the list area: the one element
             * carrying the browser's own `list` class (scoped as `<hash>_list`, so
             * the token ends with `_list`). The pinned section is inserted at its
             * top so both share one scroll region instead of the section clipping
             * its own overflow.
             */
            var scrollerOf = (listArea) => {
              var candidates = listArea.querySelectorAll("div");
              for (var i = 0; i < candidates.length; i++) {
                var className = candidates[i].className;
                if (typeof className !== "string") continue;
                var tokens = className.split(/\s+/);
                for (var t = 0; t < tokens.length; t++) {
                  if (/(^|_)list$/.test(tokens[t])) return candidates[i];
                }
              }
              return null;
            };
            var isRail = (root) => typeof root.className === "string"
              && /(?:^|\s)[^\s]*rail(?:\s|$)/.test(root.className);

            var ensure = () => {
              if (disposed) return;
              var region = document.querySelector('[data-slot="sidebar.workspaces"]');
              var root = region === null ? null : region.firstElementChild;
              if (root === null) {
                detach();
                return;
              }
              var listArea = isRail(root) ? null : listAreaOf(root);
              var scroller = listArea === null ? null : scrollerOf(listArea);
              if (listArea === null
                || scroller === null
                || listArea.querySelector('[class*="projectRow"]') === null
                || listArea.querySelector('[class*="searchResultRow"]') !== null) {
                detach();
                return;
              }
              if (node.parentNode !== scroller || node !== scroller.firstElementChild) {
                scroller.insertBefore(node, scroller.firstChild);
              }
              if (!attached) {
                attached = true;
                setHost(node);
              }
              if (watchedRegion !== region || watchedRoot !== root) {
                if (observer !== null) observer.disconnect();
                observer = new MutationObserver(() => { ensure(); });
                observer.observe(region, { childList: true, subtree: true });
                observer.observe(root, { attributes: true, attributeFilter: ["class"] });
                watchedRegion = region;
                watchedRoot = root;
              }
            };

            ensure();
            var timer = window.setInterval(ensure, RECONCILE_MS);
            return () => {
              disposed = true;
              window.clearInterval(timer);
              if (observer !== null) observer.disconnect();
              observer = null;
              if (node.parentNode !== null) node.parentNode.removeChild(node);
              setHost(null);
            };
          }, [active]);
          return host;
        }

        /**
         * Track the open workspace "..." menu and own a host element inside its
         * popup. The popup is a React portal into document.body, and the row it
         * belongs to is the only element that carries both
         * `data-row-key="workspace:<key>"` and the open-state class.
         */
        function useWorkspaceMenuAnchor(active) {
          var pair = react.useState(null);
          var target = pair[0];
          var setTarget = pair[1];
          react.useEffect(() => {
            if (!active) return undefined;
            var node = document.createElement("div");
            node.setAttribute(MENU_HOST_ATTR, "");
            var mounted = false;
            var disposed = false;
            var key = null;
            var observer = null;

            var detach = () => {
              if (node.parentNode !== null) node.parentNode.removeChild(node);
              if (mounted) {
                mounted = false;
                setTarget(null);
              }
            };
            var openRowKey = () => {
              var rows = document.querySelectorAll('[data-row-key^="' + WORKSPACE_ROW_PREFIX + '"]');
              for (var i = 0; i < rows.length; i++) {
                var className = rows[i].className;
                if (typeof className === "string" && className.indexOf("menuOpen") >= 0) {
                  return rows[i].getAttribute("data-row-key").slice(WORKSPACE_ROW_PREFIX.length);
                }
              }
              return null;
            };
            var openMenuViewport = () => {
              var menus = document.body.children;
              for (var i = 0; i < menus.length; i++) {
                var menu = menus[i];
                if (menu.getAttribute("role") !== "menu") continue;
                // The surface starts with an aria-hidden material layer, so the
                // row container is the first presentation child that holds rows.
                for (var c = 0; c < menu.children.length; c++) {
                  var viewport = menu.children[c];
                  if (viewport.getAttribute("role") !== "presentation") continue;
                  if (viewport.querySelector('[role="menuitem"]') === null) continue;
                  return viewport;
                }
              }
              return null;
            };
            var ensure = () => {
              if (disposed) return;
              var nextKey = openRowKey();
              var viewport = nextKey === null ? null : openMenuViewport();
              if (nextKey === null || viewport === null) {
                detach();
                return;
              }
              if (node.parentNode !== viewport || node !== viewport.lastElementChild) {
                viewport.appendChild(node);
              }
              if (!mounted || key !== nextKey) {
                mounted = true;
                key = nextKey;
                setTarget({ node: node, key: nextKey });
              }
            };

            ensure();
            observer = new MutationObserver(() => { ensure(); });
            // Direct children of body only: the menu is a React portal there, and
            // observing the whole subtree would run this on every app mutation.
            observer.observe(document.body, { childList: true });
            var timer = window.setInterval(ensure, RECONCILE_MS);
            return () => {
              disposed = true;
              window.clearInterval(timer);
              if (observer !== null) observer.disconnect();
              observer = null;
              if (node.parentNode !== null) node.parentNode.removeChild(node);
              setTarget(null);
            };
          }, [active]);
          return target;
        }

        /**
         * Hide the list entries a pinned workspace already covers. Applied only
         * while the pinned section is on screen, so nothing can disappear when
         * the section itself is hidden (rail, flat list, search).
         */
        function useGroupHiding(active, pinnedWorkspaces, workspaceItems) {
          react.useEffect(() => {
            if (typeof document === "undefined") return undefined;
            var tag = document.getElementById(HIDE_STYLE_ID);
            if (!active) {
              if (tag !== null) tag.textContent = "";
              return undefined;
            }
            if (tag === null) {
              tag = document.createElement("style");
              tag.id = HIDE_STYLE_ID;
              tag.dataset.plugin = "dsh-pinned-sessions";
              document.head.appendChild(tag);
            }
            var rules = [];
            var items = Array.isArray(workspaceItems) ? workspaceItems : [];
            var pinned = listOf(pinnedWorkspaces);
            for (var i = 0; i < pinned.length; i++) {
              var key = pinned[i];
              rules.push('[data-row-key="' + WORKSPACE_ROW_PREFIX + cssEscape(key) + '"]{display:none !important}');
              for (var j = 0; j < items.length; j++) {
                if (!items[j] || items[j].workspaceId !== key) continue;
                var members = Array.isArray(items[j].sessionIds) ? items[j].sessionIds : [];
                for (var m = 0; m < members.length; m++) {
                  rules.push('[data-row-key="' + SESSION_ROW_PREFIX + cssEscape(members[m]) + '"]{display:none !important}');
                }
              }
            }
            tag.textContent = rules.join("");
            return undefined;
          }, [active, pinnedWorkspaces, workspaceItems]);
        }

        /** Dispatch the Escape the shipped menu primitive already listens for. */
        function closeOpenMenu() {
          if (typeof document === "undefined") return;
          document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        }

        /** One row: status dot, Session title, owning workspace, unpin affordance. */
        function PinnedRow(props) {
          var row = props.row;
          var title = row.blank ? props.t("session.blank") : (row.title || props.t("session.blank"));
          return h("div", { className: "dshps-row" },
            h("span", { className: "dshps-dotCell" }, h("span", { className: "dshps-dot " + row.dot })),
            h("button", {
              type: "button",
              className: "dshps-title dshps-titleButton",
              title: row.where === "" ? title : title + " · " + row.where,
              "aria-label": props.t("row.open", { name: title }),
              onClick: () => { props.openSession(row.id); },
            }, title),
            row.where === "" ? null : h("span", { className: "dshps-where" }, row.where),
            props.onUnpin === undefined ? null : h("button", {
              type: "button",
              className: "dshps-action",
              title: props.t("action.unpin"),
              "aria-label": props.t("action.unpin"),
              onClick: (event) => { event.stopPropagation(); props.onUnpin(); },
            }, "×"),
          );
        }

        /** Caption plus rows for one derived status group. */
        function StatusGroup(props) {
          var group = props.group;
          return h("div", { className: "dshps-group" },
            h("div", { className: "dshps-groupTitle" },
              h("span", null, props.t(group.key)),
              h("span", { className: "dshps-count" }, String(group.rows.length)),
            ),
            group.rows.map(row => h(PinnedRow, {
              key: row.id,
              row: row,
              t: props.t,
              openSession: props.openSession,
            })),
          );
        }

        /** One explicitly pinned Session list. */
        function SessionPinGroup(props) {
          if (props.rows.length === 0) return null;
          return h("div", { className: "dshps-group" },
            h("div", { className: "dshps-groupTitle" },
              h("span", null, props.t("group.sessionPins")),
              h("span", { className: "dshps-count" }, String(props.rows.length)),
            ),
            props.rows.map(row => h(PinnedRow, {
              key: row.id,
              row: row,
              t: props.t,
              openSession: props.openSession,
              onUnpin: () => { props.unpinSession(row.id); },
            })),
          );
        }

        /** One explicitly pinned workspace: a collapsible group of its Sessions. */
        function WorkspacePinGroup(props) {
          var workspace = props.workspace;
          var open = props.collapsed !== true;
          return h("div", { className: "dshps-wsGroup" },
            h("div", {
              className: "dshps-wsHeader",
              role: "button",
              tabIndex: 0,
              "aria-expanded": open ? "true" : "false",
              "aria-label": props.t(open ? "workspace.collapse" : "workspace.expand", { name: workspace.title }),
              onClick: () => { props.toggleOpen(workspace.key); },
              onKeyDown: (event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                props.toggleOpen(workspace.key);
              },
            },
              h("span", { className: "dshps-chevron" + (open ? " dshps-chevronOpen" : "") }, "›"),
              h("span", { className: "dshps-wsTitle" }, workspace.title),
              h("span", { className: "dshps-count" }, String(workspace.sessions.length)),
              h("button", {
                type: "button",
                className: "dshps-action",
                title: props.t("action.unpin"),
                "aria-label": props.t("action.unpin"),
                onClick: (event) => { event.stopPropagation(); props.unpinWorkspace(workspace.key); },
              }, "×"),
            ),
            open ? h("div", { className: "dshps-wsSessions" }, workspace.sessions.map(row => h(PinnedRow, {
              key: row.id,
              row: row,
              t: props.t,
              openSession: props.openSession,
            }))) : null,
          );
        }

        /** Section body rendered into the host element. */
        function PinnedSection(props) {
          var parts = props.parts;
          if (parts.sessionPins.length === 0 && parts.statusGroups.length === 0 && parts.workspacePins.length === 0) return null;
          return h("div", null,
            h("div", { className: "dshps-heading" }, props.t("heading")),
            h(SessionPinGroup, {
              rows: parts.sessionPins,
              t: props.t,
              openSession: props.openSession,
              unpinSession: props.unpinSession,
            }),
            parts.statusGroups.map(group => h(StatusGroup, {
              key: group.key,
              group: group,
              t: props.t,
              openSession: props.openSession,
            })),
            parts.workspacePins.length === 0 ? null : h("div", { className: "dshps-group" },
              h("div", { className: "dshps-groupTitle" }, h("span", null, props.t("group.workspacePins"))),
              parts.workspacePins.map(workspace => h(WorkspacePinGroup, {
                key: workspace.key,
                workspace: workspace,
                collapsed: props.collapsedWorkspaces.indexOf(workspace.key) >= 0,
                t: props.t,
                openSession: props.openSession,
                toggleOpen: props.toggleWorkspaceOpen,
                unpinWorkspace: props.unpinWorkspace,
              })),
            ),
          );
        }

        /** The workspace "..." menu row injected into the shipped popup. */
        function WorkspacePinMenuItem(props) {
          var icon = props.pinned ? IconPinFill : IconPinOutline;
          return h(MenuRow, {
            icon: icon === undefined ? undefined : h(icon, {}),
            onSelect: () => {
              closeOpenMenu();
              props.onToggle();
            },
          }, props.t(props.pinned ? "menu.unpinGlobal" : "menu.pinGlobal"));
        }

        /**
         * A menu row. The shipped `MenuItemButton` carries the host styling when
         * the primitives module exposes it; the fallback keeps the row usable
         * (with the `menuitem` role the menu's keyboard walk reads) if it does
         * not, rather than failing the whole menu.
         */
        function MenuRow(props) {
          if (typeof MenuItemButton === "function") {
            return h(MenuItemButton, { icon: props.icon, onSelect: props.onSelect }, props.children);
          }
          return h("button", {
            type: "button",
            role: "menuitem",
            className: "dshps-titleButton",
            style: { display: "block", width: "100%", padding: "6px 12px" },
            onClick: props.onSelect,
          }, props.children);
        }

        /** The Session "..." menu row, a real entry in the shipped list slot. */
        function SessionPinMenuItem(props) {
          var pinnedList = listOf(props.useStore(state => state.pinnedSessions));
          var archived = props.useWorkspaces(state => state.archivedSessionIds);
          var pair = props.useMenuOpenState();
          var setMenuOpen = pair[1];
          if (Array.isArray(archived) && archived.indexOf(props.sessionId) >= 0) return null;
          var pinned = pinnedList.indexOf(props.sessionId) >= 0;
          var icon = pinned ? IconPinFill : IconPinOutline;
          return h(MenuRow, {
            icon: icon === undefined ? undefined : h(icon, {}),
            onSelect: () => {
              setMenuOpen(false);
              props.actions.toggleSession(props.sessionId);
            },
          }, props.t(pinned ? "menu.unpinGlobal" : "menu.pinGlobal"));
        }

        /**
         * `shell.overlay` occupant. It renders no overlay chrome of its own: the
         * pinned section is portaled into the sidebar host element, and the
         * workspace menu row into the open menu's popup.
         */
        function PinnedOverlay(props) {
          var enabled = props.useStore(state => state.enabled) === true;
          var prefs = props.useStore(state => state);
          var host = useAnchorHost(enabled);
          var menuTarget = useWorkspaceMenuAnchor(enabled);
          var list = props.useSessions(state => state);
          var statuses = props.useSessionStatus(state => state);
          var workspaceState = props.useWorkspaces(state => state);
          var parts = react.useMemo(
            () => deriveSections(list, statuses, workspaceState, prefs),
            [list, statuses, workspaceState, prefs],
          );
          var workspaceItems = workspaceState && Array.isArray(workspaceState.items) ? workspaceState.items : [];
          var pinnedWorkspaces = listOf(prefs && prefs.pinnedWorkspaces);
          useGroupHiding(host !== null, pinnedWorkspaces, workspaceItems);

          var nodes = [];
          if (host !== null && (parts.sessionPins.length > 0 || parts.statusGroups.length > 0 || parts.workspacePins.length > 0)) {
            nodes.push(reactDom.createPortal(h(PinnedSection, {
              key: "section",
              parts: parts,
              collapsedWorkspaces: listOf(prefs && prefs.collapsedWorkspaces),
              t: props.t,
              openSession: props.openSession,
              unpinSession: (sessionId) => { props.actions.toggleSession(sessionId); },
              unpinWorkspace: (key) => { props.actions.toggleWorkspace(key); },
              toggleWorkspaceOpen: (key) => { props.actions.toggleWorkspaceOpen(key); },
            }), host, "section"));
          }
          if (menuTarget !== null) {
            nodes.push(reactDom.createPortal(h(WorkspacePinMenuItem, {
              key: "menu",
              pinned: pinnedWorkspaces.indexOf(menuTarget.key) >= 0,
              t: props.t,
              onToggle: () => { props.actions.toggleWorkspace(menuTarget.key); },
            }), menuTarget.node, "menu"));
          }
          return nodes.length === 0 ? null : h(react.Fragment, null, nodes);
        }

        /** 设置 → 通用 row carrying the on/off switch. */
        function PinnedSettingsRow(props) {
          var enabled = props.useStore(state => state.enabled) === true;
          return h("div", { className: "dshps-setRow" },
            h("div", null,
              h("div", { className: "dshps-setTitle" }, props.t("settings.title")),
              h("div", { className: "dshps-setDesc" }, props.t("settings.description")),
            ),
            h("button", {
              type: "button",
              role: "switch",
              "aria-checked": enabled ? "true" : "false",
              "aria-label": props.t("settings.title"),
              className: "dshps-switch",
              onClick: () => { props.actions.setEnabled(!enabled); },
            }, h("span", { className: "dshps-knob" })),
          );
        }

        var inject = ["slots", "locale"];

        function apply(ctx) {
          var prefs = clientStore.defineStore({
            init: () => ({ enabled: true, pinnedSessions: [], pinnedWorkspaces: [], collapsedWorkspaces: [] }),
            persist: "dsh.pinned-sessions.prefs.v1",
            actions: {
              setEnabled: (draft, value) => { draft.enabled = value === true; },
              toggleSession: (draft, sessionId) => {
                draft.pinnedSessions = toggleIn(draft.pinnedSessions, sessionId);
              },
              toggleWorkspace: (draft, key) => {
                draft.pinnedWorkspaces = toggleIn(draft.pinnedWorkspaces, key);
              },
              toggleWorkspaceOpen: (draft, key) => {
                draft.collapsedWorkspaces = toggleIn(draft.collapsedWorkspaces, key);
              },
            },
          });

          ctx.effect(
            () => ctx.locale.register(NS, { zh: ZH, en: EN }),
            "dsh-pinned-sessions: dictionaries",
          );

          ctx.slots.inject("shell.overlay", () => ctx.slots.register({
            name: "shell.overlay",
            id: "pinned-sessions",
            order: 20,
            store: prefs,
            locale: NS,
            inject: () => ({
              openSession: (sessionId) => {
                var service = ctx.get("uiWorkspace");
                if (service === undefined || typeof service.openSession !== "function") {
                  console.warn("[dsh-pinned-sessions] uiWorkspace.openSession is unavailable");
                  return;
                }
                service.openSession(sessionId);
              },
            }),
          }, PinnedOverlay));

          ctx.slots.inject("sidebar.workspaces.session.menu.item", () => ctx.slots.register({
            name: "sidebar.workspaces.session.menu.item",
            id: "pinned-sessions",
            order: GLOBAL_PIN_ORDER,
            store: prefs,
            locale: NS,
          }, SessionPinMenuItem));

          ctx.slots.inject("settings.general.item", () => ctx.slots.register({
            name: "settings.general.item",
            id: "pinned-sessions",
            order: 40,
            store: prefs,
            locale: NS,
          }, PinnedSettingsRow));
        }

        exports.name = "dsh-pinned-sessions";
        exports.inject = inject;
        exports.apply = apply;
        return module.exports;
      },
    });
  } catch (err) {
    console.warn("[dsh-pinned-sessions] client half failed to load:", err);
  }
})();
