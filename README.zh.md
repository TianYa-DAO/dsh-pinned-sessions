# dsh-pinned-sessions（置顶会话）

> **反馈 / Feedback**：遇到 bug 或有改进建议，请到 [Issues](https://github.com/TianYa-DAO/dsh-pinned-sessions/issues) 提；也可以直接发邮件到 [2842425998@qq.com](mailto:2842425998@qq.com)。

把你不该跟丢的会话固定在 DSH Web 侧栏工作区列表顶部，并且允许从任意会话/工作区自己的「...」菜单里**全局置顶**。

[English](README.md) | 中文

## 置顶区里有什么

顺序如下，位于区域标题下方、所有工作区分组上方：

```
侧栏
├─ 工作区              ← 区域标题（搜索 / 视图选项 / 添加工作区）
├─ 置顶                ← 本插件插入
│   ├─ 全局置顶 2       ← 从会话「...」菜单置顶的会话
│   │   ● 会话标题…            proj
│   ├─ 进行中 1         ← 由会话状态推导
│   │   ● 会话标题…            other
│   ├─ 待查看 1
│   ├─ 当前打开 1
│   └─ 置顶工作区       ← 从工作区「...」菜单置顶的工作区
│       ▸ proj  4
├─ 工作区分组一         ← 被置顶的工作区在这里消失
└─ 工作区分组二
```

1. **全局置顶的会话**：从会话「...」菜单置顶；**同时仍保留在下方它自己的工作区分组里**。标题左侧的小箭头可一键折叠这一段（计数仍显示），折叠期间这些会话会重新出现在状态分组里，所以折叠不会让运行中/待查看的会话从视野里消失。
2. **进行中 / 待查看 / 当前打开**：由会话状态推导：

   | 分组 | 判据 | 圆点 |
   |---|---|---|
   | 进行中 | 会话状态 `running === true` | 蓝色呼吸点 |
   | 待查看 | 会话状态 `completionUnread === true`（跑完但你还没点开） | 绿色点 |
   | 当前打开 | 会话被主视图持有（`retainedBy.mainView > 0`） | 空心环 |

   一个会话只进其中一个分组（优先级如上）。被全局置顶的会话在「全局置顶」**展开**时不进入这些分组（状态由置顶行前面的点表示）；把「全局置顶」**折叠**后，它们会回到这些分组里。
3. **全局置顶的工作区**：从工作区「...」菜单置顶；在置顶区里渲染成可展开的分组，里面的会话可直接点开，而该工作区在**下方列表里的原分组会被隐藏**。

已归档会话、subagent 子会话不出现。组内按最近更新倒序；空的部分不显示；所有部分都为空时整段不渲染。点击行即打开该会话。

置顶区只在「按工作区分组 / 工作区树」模式下显示；侧栏收起成图标栏、切成「一张扁平列表」、或列表正在显示搜索结果时自动隐藏——而且**它隐藏时不会隐藏下方任何东西**。

## 置顶与取消置顶

1. 会话「...」菜单里新增 **全局置顶 / 取消全局置顶**：这是 DSH 官方槽位 `sidebar.workspaces.session.menu.item` 里的真实菜单项，和自带的置顶、重命名、分叉、归档并列。
2. 工作区「...」菜单里同样新增这一项。DSH 没有为工作区菜单声明槽位，所以这一项是插件门户注入进那个弹层的——靠打开行的 `data-row-key="workspace:<key>"` 定位。
3. 置顶会话行与置顶工作区标题行悬停时右侧都有取消置顶的 `×`；工作区那个是必需的，因为它原来的行在置顶期间被隐藏了。

置顶区插在**列表自己的滚动容器**最前面，所以置顶项很多时，它和工作区分组共用同一个滚动条，不会被自己裁掉。

## 开关

**设置 → 通用 → 置顶会话区**。偏好（开关、置顶的会话、置顶的工作区、哪些置顶工作区是折叠的）持久化在共享客户端 store，localStorage 键为 `dsh.pinned-sessions.prefs.v1`。

## 安装

npm：

```sh
dsh plugin add dsh-pinned-sessions
```

Release tarball：

```sh
dsh plugin add https://github.com/TianYa-DAO/dsh-pinned-sessions/releases/latest/download/dsh-pinned-sessions-0.2.1.tgz
```

桌面版可在「插件」页里安装。包内声明了 `dsh.bundle`，profile 会挂载它的 `cordis.patch.yml` 行，客户端注册表随之为浏览器提供 `./client.js`。包内还声明了 `engines.dsh`（`>=0.2.0-rc.2 <0.3.0`），市场据此显示宿主要求，并在不兼容时拦住安装。

## 实现要点

1. 纯客户端插件：`client.js` 通过动态客户端模块协议（`window.__ModuleLoader__.load`）加载；overlay 行注册进增量槽 `shell.overlay`，由它承载下面两个 portal。
2. 侧栏工作区区域（`sidebar.workspaces`）是 single 槽、区域内部没有可插入的插槽，因此本插件**不改动也不替换**自带浏览器：自己创建一个 host 元素，插到 `div[data-slot="sidebar.workspaces"]` 内**列表自己的滚动容器**（带浏览器 `list` 类、即 `overflow-y: auto` 的那个元素）最前面。插件卸载时 host 被移除。
3. 位置与模式判定全部通过稳定的 DOM 事实完成：`listArea` 类名定位列表区；`projectRow` / `searchResultRow` 行类名区分工作区分组 / 扁平列表 / 搜索结果；根节点上的 `rail` 类名判定侧栏收起。MutationObserver 负责结构变化，1.5s 轮询兜底区域被整体替换的情况。
4. 工作区菜单项被 portal 进打开菜单的弹层；弹层是 React portal 到 `document.body` 的，它属于哪一行由 `data-row-key` 加打开态类名确定。
5. 数据来自客户端根标准 hook：`useSessions` / `useSessionStatus` / `useWorkspaces`；打开会话走 `ctx.get("uiWorkspace").openSession(id)`。
6. 样式只用自己的 `dshps-*` 类，颜色全部取自 `--dsw-alias-*` 主题 token，跟随主题/皮肤。客户端半只依赖平台模块（`react`、`react-dom`、`@deepseek-ai/dsh-client-store`、`@deepseek-ai/dsh-client-ui-primitives`），所以本包没有任何安装期 npm 依赖。

## 自检

```sh
npm test
```

用桩化的动态模块协议加载 `client.js`，校验：工厂与导出形状、`apply()` 的三次注册（槽位 / id / order / 共享 store / inject face / 双语字典）、分区推导（优先级、归档与 subagent 过滤、空会话、显式置顶、置顶工作区）以及渲染树。

## 已知限制

1. 依赖自带客户端的 DOM 与类名（`listArea` / `projectRow` / `searchResultRow` / `rail` / `list`）。DSH 若重构侧栏结构，需要同步更新 `client.js` 里的锚点选择器。
2. 工作区「...」菜单项是注入的（DSH 没有该槽位）；那个弹层的结构一变，就要同步更新 `client.js` 里的定位逻辑。
3. 客户端包版本变化（如方法或 hook 改名）可能导致注册失败；`client.js` 对 `uiWorkspace` 缺失做了降级告警，不做静默失败。
4. 实测环境为 DSH `0.2.1-rc.1`；`engines.dsh` 保证声明范围与实测一致。

## 许可

[MIT](LICENSE)
