/**
 * dsh-pinned-sessions — client half.
 *
 * Adds a pinned section at the top of the sidebar's workspace browsing region
 * (below the region header, above every workspace group) holding the Sessions a
 * user must not lose track of:
 *
 *   - running            (Session status snapshot `running`)
 *   - finished, unopened (`completionUnread` — the green "done" reminder)
 *   - currently open     (the Session retained by the main view)
 *
 * Placement: the sidebar's workspace region has no insertion hole of its own,
 * so this plugin renders through the additive `shell.overlay` seat and portals
 * its content into a host element this plugin owns, inserted between the
 * region's own section header and its session list. The host element is the
 * only DOM this plugin adds, it takes its natural height in the region's flex
 * column, and it is removed with the plugin fiber. The shipped browser is never
 * replaced or re-implemented, so the ordinary workspace groups keep working
 * unchanged (these Sessions stay listed in their own workspace as well).
 *
 * The section appears only while the region shows workspace groups: it hides in
 * rail (collapsed sidebar) state, in the flat "one list" grouping, and while
 * search results are on screen. 设置 → 通用 carries the on/off switch; the
 * preference is persisted by the shared Client store.
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

        var NS = "pinned-sessions";
        var h = react.createElement;
        var STYLE_ID = "dsh-pinned-sessions/pinned.css";
        var HOST_ATTR = "data-dsh-pinned-sessions";
        var RECONCILE_MS = 1500;

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
          ".dshps-where{flex:none;max-width:42%;margin-left:6px;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
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
          "group.running": "进行中",
          "group.unread": "待查看",
          "group.current": "当前打开",
          "session.blank": "新会话",
          "row.open": "打开会话 {name}",
          "settings.title": "置顶会话区",
          "settings.description": "在侧栏工作区列表顶部固定「运行中 / 跑完未点开 / 当前打开」的会话。仅在按工作区分组时显示。",
        };
        var EN = {
          "heading": "Pinned",
          "group.running": "Running",
          "group.unread": "Unread",
          "group.current": "Open now",
          "session.blank": "New session",
          "row.open": "Open session {name}",
          "settings.title": "Pinned sessions",
          "settings.description": "Keeps running, finished-but-unopened and currently open sessions at the top of the sidebar workspace list. Shown only while sessions are grouped by workspace.",
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

        /**
         * Fold the three Session list snapshots into the pinned groups.
         * A Session lands in exactly one group, preferring running, then unread,
         * then currently open. Archived and subagent Sessions never appear.
         */
        function deriveGroups(list, statuses, workspaceState) {
          if (!list || !Array.isArray(list.ids) || !list.byId) return [];
          var archived = {};
          var archivedIds = workspaceState && workspaceState.archivedSessionIds;
          if (Array.isArray(archivedIds)) {
            for (var a = 0; a < archivedIds.length; a++) archived[archivedIds[a]] = true;
          }
          var whereBySession = {};
          var items = workspaceState && workspaceState.items;
          if (Array.isArray(items)) {
            for (var w = 0; w < items.length; w++) {
              var item = items[w];
              var members = item && item.sessionIds;
              if (!Array.isArray(members)) continue;
              var label = (item.title && String(item.title)) || baseName(item.path);
              for (var m = 0; m < members.length; m++) {
                if (whereBySession[members[m]] === undefined) whereBySession[members[m]] = label;
              }
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
          var running = [];
          var unread = [];
          var current = [];
          for (var i = 0; i < list.ids.length; i++) {
            var id = list.ids[i];
            var session = list.byId[id];
            if (!session || archived[id] === true || session.origin === "subagent") continue;
            var status = statuses && typeof statuses.get === "function" ? statuses.get(id) : undefined;
            var row = {
              id: id,
              title: typeof session.displayTitle === "string" ? session.displayTitle : "",
              blank: session.blank === true,
              updatedAt: typeof session.updatedAt === "number" ? session.updatedAt : 0,
              where: whereBySession[id] || baseName(session.cwd),
            };
            if (status && status.running === true) running.push(row);
            else if (status && status.completionUnread === true) unread.push(row);
            else if (id === currentId) current.push(row);
          }
          var groups = [
            { key: "group.running", dot: "dshps-dot-running", rows: running },
            { key: "group.unread", dot: "dshps-dot-unread", rows: unread },
            { key: "group.current", dot: "dshps-dot-current", rows: current },
          ];
          var out = [];
          for (var g = 0; g < groups.length; g++) {
            if (groups[g].rows.length === 0) continue;
            groups[g].rows.sort(byRecency);
            out.push(groups[g]);
          }
          return out;
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
              if (listArea === null
                || listArea.querySelector('[class*="projectRow"]') === null
                || listArea.querySelector('[class*="searchResultRow"]') !== null) {
                detach();
                return;
              }
              if (node.parentNode !== root || node.nextElementSibling !== listArea) {
                root.insertBefore(node, listArea);
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

        /** One pinned row: status dot, Session title, owning workspace. */
        function PinnedRow(props) {
          var row = props.row;
          var title = row.blank ? props.t("session.blank") : (row.title || props.t("session.blank"));
          return h("button", {
            type: "button",
            className: "dshps-row",
            title: row.where === "" ? title : title + " · " + row.where,
            "aria-label": props.t("row.open", { name: title }),
            onClick: () => { props.openSession(row.id); },
          },
            h("span", { className: "dshps-dotCell" }, h("span", { className: "dshps-dot " + props.dot })),
            h("span", { className: "dshps-title" }, title),
            row.where === "" ? null : h("span", { className: "dshps-where" }, row.where),
          );
        }

        /** Caption plus rows for one pinned group. */
        function PinnedGroup(props) {
          var group = props.group;
          return h("div", { className: "dshps-group" },
            h("div", { className: "dshps-groupTitle" },
              h("span", null, props.t(group.key)),
              h("span", { className: "dshps-count" }, String(group.rows.length)),
            ),
            group.rows.map(row => h(PinnedRow, {
              key: row.id,
              row: row,
              dot: group.dot,
              t: props.t,
              openSession: props.openSession,
            })),
          );
        }

        /** Section body rendered into the host element. */
        function PinnedSection(props) {
          if (props.groups.length === 0) return null;
          return h("div", null,
            h("div", { className: "dshps-heading" }, props.t("heading")),
            props.groups.map(group => h(PinnedGroup, {
              key: group.key,
              group: group,
              t: props.t,
              openSession: props.openSession,
            })),
          );
        }

        /**
         * `shell.overlay` occupant. It renders no overlay chrome of its own: its
         * whole body is portaled into the sidebar host element the hook owns.
         */
        function PinnedOverlay(props) {
          var enabled = props.useStore(state => state.enabled);
          var host = useAnchorHost(enabled === true);
          var list = props.useSessions(state => state);
          var statuses = props.useSessionStatus(state => state);
          var workspaceState = props.useWorkspaces(state => state);
          var groups = react.useMemo(
            () => deriveGroups(list, statuses, workspaceState),
            [list, statuses, workspaceState],
          );
          if (enabled !== true || host === null || groups.length === 0) return null;
          return reactDom.createPortal(
            h(PinnedSection, { groups: groups, t: props.t, openSession: props.openSession }),
            host,
          );
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
            init: () => ({ enabled: true }),
            persist: "dsh.pinned-sessions.prefs.v1",
            actions: {
              setEnabled: (draft, value) => { draft.enabled = value === true; },
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
