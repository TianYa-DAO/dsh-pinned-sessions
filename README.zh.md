# dsh-pinned-sessions（置顶会话）

把「**运行中** / **跑完未点开** / **当前打开**」的会话固定显示在侧栏工作区列表的顶部——位于「工作区」区域标题下方、所有工作区分组上方。

这不是 DSH 自带的手动置顶（那个置顶只在各自工作区分组内排前），而是按**会话状态**自动置顶的一段独立区域。被置顶的会话**同时仍保留在它自己的工作区分组里**。

[English](README.md) | 中文

## 位置与生效条件

```
侧栏
├─ 工作区            ← 区域标题（搜索 / 视图选项 / 添加工作区）
├─ 置顶              ← 本插件插入
│   ├─ 进行中 1
│   │   ● 会话标题…            proj
│   ├─ 待查看 1
│   │   ● 会话标题…            other
│   └─ 当前打开 1
│       ● 会话标题…
├─ 工作区分组一
└─ 工作区分组二
```

只在「按工作区分组 / 工作区树」模式下显示；以下情况自动隐藏：

1. 侧栏收起成图标栏（rail）；
2. 视图切换为「一张扁平列表」；
3. 搜索框展开、列表正在显示搜索结果。

## 分组规则

| 分组 | 判据 | 圆点 |
|---|---|---|
| 进行中 | 会话状态 `running === true` | 蓝色呼吸点 |
| 待查看 | 会话状态 `completionUnread === true`（跑完但你还没点开） | 绿色点 |
| 当前打开 | 会话被主视图持有（`retainedBy.mainView > 0`） | 空心环 |

1. 一个会话只出现在**一个**分组里，优先级：进行中 → 待查看 → 当前打开。
2. 已归档会话、subagent 子会话不出现。
3. 组内按最近更新倒序；空分组不显示；三个分组都为空时整段不渲染。
4. 点击行 = 打开该会话（等同侧栏原有行为）。

## 开关

**设置 → 通用 → 置顶会话区**。关闭后整段区域不渲染，偏好持久化在客户端 store（localStorage `dsh.pinned-sessions.prefs.v1`）。

## 安装

npm：

```sh
dsh plugin add dsh-pinned-sessions
```

Release tarball：

```sh
dsh plugin add https://github.com/TianYa-DAO/dsh-pinned-sessions/releases/latest/download/dsh-pinned-sessions-0.1.0.tgz
```

桌面版可在「插件」页里安装。包内声明了 `dsh.bundle`，profile 会挂载它的 `cordis.patch.yml` 行，客户端注册表随之为浏览器提供 `./client.js`；宿主行已挂载时客户端半会被直接热加载。

## 实现要点

1. 纯客户端插件：`client.js` 通过动态客户端模块协议（`window.__ModuleLoader__.load`）加载，注册进增量槽 `shell.overlay`，React portal 挂在其上。
2. 侧栏工作区区域（`sidebar.workspaces`）是 single 槽、且区域内部没有任何可插入的插槽，因此本插件**不改动也不替换**自带浏览器：它自己创建一个 host 元素，插到 `div[data-slot="sidebar.workspaces"]` 内浏览器根节点的「区域标题」与「会话列表」之间。host 只是浏览器根 flex 列里的一个普通子元素，跟随列表自然占位，插件卸载时移除。
3. 位置与模式判定全部通过稳定的 DOM 事实完成：宿主元素插入点用 `listArea` 类名定位；分组模式 / 搜索模式用列表内的 `projectRow` / `searchResultRow` 行类名判定；rail 状态用根节点上的 `rail` 类名判定。MutationObserver 负责结构变化，1.5s 轮询兜底区域被整体替换的情况。
4. 数据来自客户端根标准 hook：`useSessions` / `useSessionStatus` / `useWorkspaces`；打开会话走 `ctx.get("uiWorkspace").openSession(id)`。
5. 样式只用自己的 `dshps-*` 类，颜色全部取自 `--dsw-alias-*` 主题 token，因此跟随主题/皮肤。客户端半只依赖平台模块（`react`、`react-dom`、`@deepseek-ai/dsh-client-store`），所以本包没有任何安装期 npm 依赖。

## 自检

```sh
npm test
```

用桩化的动态模块协议加载 `client.js`，校验：工厂与导出形状、`apply()` 的两次注册（槽位 / id / order / 共享 store / inject face / 双语字典）、分组推导（优先级、归档与 subagent 过滤、倒序、空组省略、空会话），以及渲染树。

## 已知限制

1. 依赖自带客户端的 DOM 与类名（`listArea` / `projectRow` / `searchResultRow` / `rail`）。DSH 若重构侧栏结构，需要同步更新 `client.js` 里的锚点选择器。
2. 客户端包版本变化（如方法或 hook 改名）可能导致注册失败；`client.js` 对 `uiWorkspace` 缺失做了降级告警，不做静默失败。
3. 实测环境为 DSH `0.2.0-rc.2`。

## 许可

[MIT](LICENSE)
