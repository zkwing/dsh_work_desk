# dsh-workbench

工作区的可视化拓展插件：它本身就是一个**全局面板**（和「工作区」同样的挂载方式）——
侧边栏面板列表里多一行「工作台」，选中它就把中列换成控制室：**一张卡片就是一个工作区**，
卡片正文就是该工作区的文件资源管理器，网格末尾留一个带加号的空卡片位，
点它走与侧边栏「添加工作区」完全相同的目录选择流程。同一份包同时运行在普通 `dsh web` 和 DSH Desktop 上。

卡片正文是一个 **VS Code 形状的资源管理器**：一个扁平行列表，按层缩进并画竖线导引，
目录带展开箭头与开合图标，文件用 `ui-primitives` 的 `FileTypeIcon` 按扩展名出图标，
目录在前、其后按自然序（`file2` 排在 `file10` 前），方向键上下移动、左右展开/折叠，
每个目录只在**第一次展开**时去列它那一层。

手势也照编辑器：**单击选中**、点目录行展开/折叠、**双击文件（或选中后按回车）在右侧栏打开**——
默认打开本插件自带的**工作台编辑器**（可看可改，Ctrl+S 保存），标题栏的 ◱ 按钮随时切到官方只读预览
（Markdown / 图片 / PDF 交给官方渲染）；**点卡片标题打开工作区**，
等价于在官方侧边栏点一行工作区（连接/复用空白会话 → 打开会话 → 中列换回对话）。

添加工作区**两种目录选择后端都支持**，而且是同一个按钮：先问 Host 的系统选择器，
被拒（说明这次启动组的是 browse 后端）就换成插件自己的应用内目录浏览器——
它带一条**可编辑的地址栏**（输入/粘贴路径 → 回车或「前往」，「↑」上一层、面包屑可点），
也就是系统对话框地址栏的那种用法。DSH Desktop 正是 browse 后端：它的启动图里挂的是
`ui-directory-picker-browse` 而不是 `-native`（`directory-picker-auto` 在启动时按
bind host / SSH / 显示会话解析一次，Desktop 那次解析落在 browse）。

双击文件时若右侧栏还没有座位，面板会把它补上——补的不是「选会话」，而是**把中列交回对话视图**：
右侧栏的根控制器只在 `activePanelId === null` 时渲染会话席位（`ui-sidebar-right` 的
`RightbarRoot` 里就是一句 `if (!visible) return null`；官方 README 也写明它
「mounts the Session-scoped `rightbar.session` subtree only while the Conversation is selected」）。
工作台本身是全局面板，所以在工作台里开文件**必然**要把中列交回对话，顺序是
`ctx.sessions.open(该会话)` → `ctx.layout.selectPanel(null)` → 轮询到席位出现（上限约 5 秒）→ 开文件。
行 tooltip 与资源管理器底部提示都写明了「双击文件会在对话视图的右侧打开」。

```
┌ 侧边栏 ─────────┐   ┌ 中列 = 工作台（全局面板，不是浮层）──────────────┐
│ 新建会话         │   │ 控制室        [运行中] [+ 添加工作区] [刷新]      │
│ ▸ 工作台   ← 新行 │   │ ┌ 工作区 ─┬ 会话 ─┬ 最近更新 ┬ 当前时间 ┐        │
│                  │   │ │   3     │  5    │  16:20   │ 16:20:31 │        │
│ （工作区/会话树） │   │ └─────────┴───────┴──────────┴──────────┘        │
│                  │   │ ┌ WORK_DESK      D:\3_WorkProject\ ⇅ ⟳ ┐ ┌ … ─────┐
│                  │   │ │ ▾ src           2.1 KB              │ │        │
│ ⚙ 设置           │   │ │ │ ▸ client      1.4 KB              │ │   ＋   │
└──────────────────┘   │ │ ▸ README.md     0.7 KB              │ │添加工作区│
                       └─┴─────────────────────────────────────┴─┴────────┘
```

## 视觉与主题

面板**整体跟随 DSH 主题**：底色、卡片层、文字、边框、强调色、状态色、背景网格 —
**没有一处是字面色**。所有可见颜色都派生自宿主别名 token（`--dsw-alias-bg-base` /
`-bg-layer-1|2` / `-bg-overlay` / `-border-l1|l2` / `-label-primary|secondary` /
`-brand-primary` / `-state-*-primary`）；少数 `var(…, 颜色字面量)` 的写法只在
**宿主完全不提供主题 token** 时作为最后一道兜底生效，正常环境下永远走 alias。
token 统一声明在 `:root`（这样 portaled 的选择器对话框也继承到），
所以浅色、深色、以及注册进来的第三方主题都对。面板自己**不再**声明 `color-scheme`
——那是布局的 theme presenter 在 `html` 上的职责。

**六张卡片强调色**也是 token 派生而非字面色（顺序：azure / violet / amber / emerald / rose / slate，
`accentFor(index)` 按 6 循环，保证相邻卡片颜色不同）：

| 位置 | 派生方式 | 取自 |
| --- | --- | --- |
| azure | `oklch(from --dsw-alias-brand-primary l 0.16 240)` | brand-primary 的 l + 钉住的 C + 固定 hue 240° |
| violet | `oklch(from --dsw-alias-brand-primary l 0.16 290)` | brand-primary 的 l + 钉住的 C + 固定 hue 290° |
| amber | 直接消费 | `--dsw-alias-state-warn-primary` |
| emerald | 直接消费 | `--dsw-alias-state-success-primary` |
| rose | 直接消费 | `--dsw-alias-state-error-primary` |
| slate | 直接消费 | `--dsw-alias-label-secondary` |

azure / violet 之所以 `oklch(from …)` 而不是直接消费 brand-primary，是因为 brand-primary 本身
是近无彩色（chroma ≈ 0.006 light / 0.003 dark），只取它的 l（明度随主题走）、把 C 钉在 0.16
保持原蓝/紫饱和度、色相写死 240°/290° — 这样浅色下是深蓝/深紫、深色下是淡蓝/淡紫，
两两相邻在两种配色下都可辨，也与 slate 的中性灰明显区分。

**背景网格**由 `::before` 一层四条渐变画成：**16px 细格 + 80px 粗格**（比早先的 32px 密），
网格颜色**由 alias token 派生**而不是写死的字面色：深色配色下取 `--dsw-alias-label-primary`
的低 alpha 混合（暗色下该 token 近白，混出来是冷色低对比网格），浅色配色下取
`--dsw-alias-state-warn-primary`（即 amber，浅色下是金色"工程图"底纹），
所以一个第三方主题只要重调这两个 alias，整面网格就跟着换色，不用本插件再写一条规则。

**浅色配色下每个模块单独"浮"起来**：宿主浅色的 `bg-base` / `bg-layer-1` / `bg-overlay`
本身都是近白，模块若直接取这几个 alias 就会糊成一片。所以浅色分支额外声明了一组
**模块材质 token**（画布 `--wb-bg` 染成带墨的纸、顶部 `--wb-ambient-halo` 改白光、
`--wb-glass-edge` 换成更利落的发丝边、`--wb-rim-top` 取略浅的顶边、
`--wb-card-base` / `--wb-card-rim` / `--wb-card-shadow` 三件套），再由一段
`:root[data-wb-scheme='light']` 作用域规则给各模块各自的材质：

| 模块 | 浅色下的材质 |
| --- | --- |
| 顶栏 `.panelHead` | 白底 + 底部发丝线 + 一层薄投影，卡片网格从它**后面**滚过 |
| 顶栏徽标 `.headGlyph` | 实心墨色"拱心石"+ 纸色字形（浅色 brand 本身近黑，实心比低 alpha 洗色更像有意为之） |
| 读数条 `.readings` / `.reading` | 墨色浅托盘，四条读数各站一张**白色仪表砖**（发丝边 + 两层接触阴影 + 顶沿 2px 强调色导轨） |
| 卡片 `.card` | 近白**纸面**（`--wb-card-base` 94% 白）+ 顶部一层强调色淡染；深色那套四层玻璃在浅色下收敛成两层 |
| 资源管理器 `.explorer` | 在卡片里**凹进去的井**：自己的边 + 内阴影 |
| 底栏 `.panelFoot` | 比读数托盘更淡的横条，形成 顶栏 → 托盘 → 卡片区 → 底座 的层次 |
| 空位 / 空态 `.addCard` / `.empty` | 半透明白 + 实发丝边 + 与卡片同款接触阴影，空网格也读成"布局"而不是"洞" |

**深色分支一个字节都没动**：所有会跟卡片状态打架的属性（`border-color` / `box-shadow`）
走的是上面那组 token，浅色只换 token 的值，所以卡片的 hover / focus / running / completed
四种状态在两种配色下都仍然成立，不需要在浅色分支里重抄一遍。

卡片是**液晶玻璃**：半透明层 + `backdrop-filter: blur(22px) saturate(180%)`，
亮边（`border-top-color` 提亮）、内侧高光与下沉阴影，加一道斜向镜面高光，
hover 时高光缓慢扫过并轻微上浮（浅色分支把模糊收敛到 `blur(18px) saturate(150%)`，
因为浅色卡片背后本来就没有多少颜色可糊）。深色下玻璃的色调从 `--wb-glass-tint`
（= 当前文字色）混合而来，一套配方成立；浅色下则由 `--wb-card-base` 换成近白纸面。
全部新增的 hover / focus / sheen 动画都在 `@media (prefers-reduced-motion: reduce)` 内被设为
`transition: none` + `--wb-sheen-angle: 0deg`，动画一律关掉。

外观/主题变更的**自动传播路径**：`ctx.theme` 的 `active.colorScheme` 通过注册的 `hooks.scheme`
绑定成 `useScheme` 选择器 hook，面板根上落 `data-wb-scheme="light|dark"`，样式表据此切换；
`theme/change` 事件由 `ctx.on('theme/change', …)` 订阅，每一次主题翻转都会即时更新
`data-wb-scheme` — 也就是说 DSH Desktop 上点切换主题、注册第三方主题、或调整任何 alias token，
工作台界面的所有 token 派生色（含背景网格和六张卡片强调色）都会在同一帧内跟随变化，
不需要本插件做任何额外注册。

## 四条硬约束

这个面板**不覆盖**会话：它占中列，和「工作区」及其他全局面板一样由布局切换，
所以选中它时对话仍在侧边栏可选、切换回去即刻恢复。

插件**不能因为可选能力缺失就整个不挂载**。服务分两层：

| 层 | 服务 | 缺失时的行为 |
| --- | --- | --- |
| 必需 | `slots`、`locale` | 没有它们就没有槽位与文案，插件不注册（这是唯一合理的 pending） |
| 可选 | `uiWorkspace`、`workspaces`、`remote.workspaceFiles`、`remote.directoryPicker`、`sidebarRight` | 面板照常挂载：相关控件禁用、面板顶部说明缺什么，卡片内文件列表给出一行失败级 + 重试 |

插件**不能把可选能力在 `apply` 时探一次就定死**。这是本插件踩过的坑，也是它现在形状的原因：

- 本插件的 `dsh.client.inject` 只有 `slots`、`locale`，所以 `apply` 跑得很早；
- 而 `remote.workspaceFiles` 是 Remote 命名空间，由 `dsh-api-remotes` 的**异步** `apply` 逐个 `$mount()` 挂上，
  排在 15 个命名空间的最后一个；`ui-workspace` 也晚于本插件；
- 槽位条目的 `inject` 工厂**只跑一次并被缓存**（`ui-renderer` 的 `rootInjectCache`，按条目做 WeakMap 键），

所以「在 `apply` 里 `ctx.get()` 一次，缺了就传 `undefined`」会把这个判断冻结在页面生命周期里。
现在的做法是两件事分开：

1. **动作**永远存在，每次调用时才用 `ctx.get(name)` 解析服务（缺了就是空操作）；
2. **能力开关**放在一个可订阅的源里（`createCapabilityStore()`），由 `ctx.inject([name], …)` 在服务
   挂上/卸下时翻转；它作为注册的 `hooks` 成员交给槽位框架，绑定成 `useCapability` 选择器 hook
   （`InjectFace` 的惯例），于是服务晚到时面板自己重渲染，不需要重注册。

插件**不能假定「选目录」就是一次 `pickDirectory()`**。一次启动只组一种目录选择交互
（`dsh-host-directory-picker-auto` 在启动时按 bind host / SSH / 显示会话解析出 `native` 或 `browse`，
并把 Host 后端与客户端界面**配对**挂上），而 `DirectoryPickerController` 对这次交互服务不了的动词是
**明确拒绝而非近似**：

- `native`（本机 `dsh web` 就是这种）：`directoryPicker/pick` 可用，`list`/`createDirectory` 被拒；
- `browse`（**DSH Desktop 是这种**：`ui-directory-picker-browse` 在启动图里、`-native` 不在）：
  `pick` 被拒，报 `directory-picker/unavailable`，只有浏览原语可用。

官方侧边栏那条「Add workspace…」之所以两种都能用，是因为它把交互界面做成 `*.directoryFlow` 单席位的
**占位者**——而那两个席位已经被配对的官方界面占了，且由侧边栏/会话菜单的局部 state 打开，
没有对外服务可以唤起。所以本插件自带一个应用内目录浏览器（`WorkspaceDirectoryPicker`），
在 `pick` 被拒时接手；被拒是**流程的分叉，不是一个错误**。
另外，失败必须**显示出来**：以前 `void addWorkspace()` 把 reject 吞进未处理的 promise，
点了加号什么都不会发生——这正是「无法添加目录」的观感来源。

## 三条要求与实现

| 要求 | 实现 |
| --- | --- |
| 1. 工作台是工作区的拓展，加一个工作区就多一张卡片 | 卡片列表直接读 Host 工作区快照：`useWorkspaces`（`ctx.workspaces.list`，由 `ui-workspace` 经 `ctx.slots.provideRoot` 提供的全局标准 hook）。插件**没有自己的名单与存储**，所以在任何地方增删工作区，网格同步变化。点卡片标题 = 官方侧边栏点一行工作区（`ctx.uiWorkspace.openWorkspace`：连接/复用空白会话 → 打开 → `layout.selectPanel(null)`） |
| 2. 原有添加工作区入口保留，卡片区另有加号空位可点击新增 | 标题栏 `[+ 添加工作区]` 与网格末尾的加号卡片走同一条流程：先 `remote.directoryPicker.pick()`（系统选择器），被拒就打开插件自带的 `WorkspaceDirectoryPicker`（`uiWorkspace.listDirectory` / `createDirectory`），两条路最后都落到同一个登记动作 `ctx.workspaces.create({ path })`。侧边栏原有的「Add workspace…」入口完全没动。任何一步失败都会在面板顶部显示 Host 给的原因，而不是静默 |
| 3. 每个工作区在卡片里显示文件列表（VS Code 方式） | 卡片正文是 `FileExplorer`：`remote.workspaceFiles.list(sessionId, path, signal)` 按层懒加载，扁平行列表 + 缩进导引 + 类型图标 + 选中态 + 方向键（`explorerRows()` 负责行序与层级，纯函数、可单独断言）。点卡片标题触发**本地状态机**：`openWorkspace()` Promise 触发时进入 `running`（蓝色沿边旋转），resolve 时进入 `completed`（绿色边沿跳动），失败回 `idle`（白色边沿）；`completed` 状态下未确认时点卡片一次置 `acknowledged`（停止跳动）。状态机写在卡片组件本地，词汇固定，未来要接真实信号只需替换写入点（见 `cards.ts`） |
| 4. 双击文件在右侧专门界面显示内容 | 双击（或回车）= `ctx.sidebarRight.openTab('workbench-editor', { sessionId, path })`，本插件自带的编辑器页签在右侧栏展开；标题栏 ◱ 走 `openResource(fileAddress(...))` 切到官方 `text` 类型（代码高亮 / Markdown / PDF / 图片）。地址文法由本插件按文档自己实现（`fileAddress()`），因为 `dsh-util-workspace-path` 不在平台基线模块表里；没人认领地址时的抛错被转成面板顶部一行提示 |
| 5. 像 VS Code 一样能编辑并保存 | 编辑器通过**本插件自己的 Host 路由**读写：`POST /workbench/file/read` 取文本 + 版本，`POST /workbench/file/write` 原子替换。写有三道闸：**只改已存在的普通文件**、**路径必须在该会话的工作区根内**、**版本必须仍是读到的那个**（对不上答 `workbench/stale`，编辑器让你先重新读取而不是覆盖）。沙箱策略用的是组合自己解析出来的那份（会话 live 时带会话 override；会话没加载时用**持久化的 cwd** 当 `workspace-write` 边界、模式仍取部署默认——与 DSH 对 live 会话的规则一致，不额外放宽）。所以 `read-only` 部署下保存就是被拒 |

卡片正文用**该工作区第一个会话**作为 scope id，因为 Host 的 `list` 会用这个会话的 workspace root 做包含校验
（`workspace-file/outside-workspace` 会被转成行内提示 + 重试按钮，不会抛出）。工作区还没有会话时，
卡片提示先新建会话。

## 兼容性

这是本插件最重要的设计约束，也是它为什么能同时在两种客户端上跑：

| 事实 | 结果 |
| --- | --- |
| 只声明官方 DSH 服务 `slots`、`locale` 为必需 | 普通 `dsh web` 与 DSH Desktop 都能加载 |
| 不注入 `desktopProfiles` / `desktopPnpm` | 不在 Desktop 之外 pending；也不需要 Desktop 判别 |
| 通过 `main` + `sidebar.panellist` 两个官方槽位组合 | 不 import 侧边栏包、不 patch 官方行；面板由布局服务切换，不覆盖会话 |
| 只请求平台基线外部模块（`react`、`react/jsx-runtime`、`ui-primitives`） | 模块表都能答复，没有额外 `dsh.client.external` 请求 |
| 选目录同时兼容 `native` 与 `browse` 两种交互，且不注册进官方那两个单席位 | 在 CLI `dsh web`（native）与 DSH Desktop（browse）上点同一个加号都能加工作区 |
| 浏览器半 + 纯声明式 Host 半 | 两种 Desktop 呈现模式（兼容模式用上游 Web client、高级模式用 Desktop 自有 frame）都成立 |

参考：[DSH Desktop 插件开发](https://github.com/anywhere-labs/dsh-desktop/blob/v2.0.1/docs/plugin-development.md)、
[`desktopProfiles` / `desktopPnpm` 服务契约](https://github.com/anywhere-labs/dsh-desktop/blob/v2.0.1/dsh-plugin-desktop/docs/plugin-services.md)、
[awesome-dsh-plugin 收录规则](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)（`dsh.bundle` + `dsh plugin add`）。

## 构建

插件在本仓库授权源码，用 DSH checkout 自带的客户端预设编译（产物格式必须与官方包一致，
`window.__ModuleLoader__.load({ id, factory })` 闭包工厂 + 平台模块表外部引用）。

```powershell
powershell -ExecutionPolicy Bypass -File build-plugin.ps1
node scripts\verify-artifact.mjs
```

`build-plugin.ps1` 的编排：源码 → 暂存到 `<checkout>/packages/plugins/dsh-workbench`（`private: true`，
不参与 pnpm workspace）→ `tsc` 产出 `lib/types`（消费包的 **已构建声明** 而非源码，保证 out-of-tree 项目的
`rootDir/outDir` 自洽）→ `tsdown` 产出 `lib/client.js` → 校验标记 → 收回本目录 `lib/`。

`verify-artifact.mjs` 用最小宿主复刻模块表的握手与注册流程，检查 95 条契约项，分八组：
注册 id 与工厂、外部请求全在基线内、导出面；`apply()` 恰好两次注册（`main`/`workbench` 面板体 +
`sidebar.panellist` 行）与两处的注入面；真的调一遍业务面（取消选择不建工作区、选中即登记、Host 拒绝时
把原因报出来、越界列表转成行内错误、应用内浏览器的两个原语）；**晚到能力**（服务在 `apply` 之后才挂上，
能力开关与动作都跟上）；资源管理器的行模型；添加流程的分支表；以及**降级装配**（一个什么工作区服务都没有
的宿主上仍然注册两个槽位，动作成为有内容的失败而不是静默）。

## 安装

插件以路径安装。`dsh plugin add` 会用安装后的真实包名回填 `profile.json` 的依赖与 `dsh.profile.bundles`：

```sh
# 普通 DSH
dsh plugin --profile web add D:\3_WorkProject\work_desk\plugins\dsh-workbench

# DSH Desktop：用托盘 → Open DSH Terminal，然后
dsh plugin add D:\3_WorkProject\work_desk\plugins\dsh-workbench
```

**`--profile desktop` 不能用。** 官方 CLI 明确拒绝：`profile "desktop" is managed exclusively by the Electron application`。
Desktop profile 只能通过 Desktop 自己的终端（那里的裸 `dsh` 默认作用于当前激活 profile）或
`desktopPnpm.runPlugin()` 管理。要装进 `desktop`，先切到 desktop profile 再用不带 `--profile` 的命令。

实测（本机 web profile）：

```
dependencies:
+ dsh-workbench link:D:/3_WorkProject/work_desk/plugins/dsh-workbench
Done in 913ms using pnpm v11.8.0
```

安装后 `profiles/web/package.json` 变成：

```json
{
  "dependencies": { "dsh-workbench": "link:D:/3_WorkProject/work_desk/plugins/dsh-workbench" },
  "dsh": { "profile": { "bundles": [
    "@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", "dsh-workbench"
  ], "patchReload": "live" } }
}
```

`dsh-workbench` 进入 `bundles` 是自动的：CLI 按「解析到的包是否声明 `dsh.bundle`」重建层级列表，
不靠命令行 spec 的写法。安装完重启才生效（Desktop 是托盘 → 退出后重新打开）。

卸载：

```sh
dsh plugin remove dsh-workbench          # Desktop 终端，作用于当前 profile
dsh plugin --profile web remove dsh-workbench
```

## 装到另一台电脑

上面那条安装命令是 `link:` 到本机路径的，所以**别的电脑**要先拿到可分发的产物。两条路：

```powershell
# A. tarball（自包含：目标机器不需要 DSH checkout，也不需要构建）
pnpm pack                                                      # 本机 → dsh-workbench-0.1.0.tgz
dsh plugin --profile web add .\dsh-workbench-0.1.0.tgz         # 目标机器；Desktop 换成 --profile desktop
dsh --profile web --dump-config | Select-String workbench       # 确认那一行进了配置树
# 然后重启宿主／应用

# B. git 仓库（想一条命令更新时）
# 仓库里必须提交 lib/（含 client.js 与 lib/types 声明）+ cordis.patch.yml + package.json + README
dsh plugin --profile web add github:<you>/dsh-workbench
```

要点：

- **必须随包分发 `lib/`**：本包的构建依赖 DSH checkout 与那里被导出的 `tsdown.client.ts`
  `clientConfig()`，目标机器**无法自行构建**。tarball 已带上 `lib/client.js`、`lib/index.js`
  与 `lib/types/**/*.d.ts`（`files` 字段与 `build-plugin.ps1` 的收集步骤保证这一点）。
- tarball 安装是 `file:` 依赖，pnpm 会把它复制进 store —— 不像 `link:` 那样依赖某个路径一直存在。
- `--profile desktop` 只能用**应用自带的** `dsh`（PATH 上那个 shim）；checkout 里的 CLI 会拒绝该 profile 名。
- 装完**必须重启**：Host 半只在启动时装载，客户端 bundle 也是启动时快照。
- 目标机器上别同时装坏插件：一个 `apply` 抛错的 bundle 会让整个 profile 起不来
  （`dsh` 直接报 `plugin tree failed to load`）。

## 验证

四层证据，都能在本机复跑：

| 层 | 命令 | 覆盖 |
| --- | --- | --- |
| 产物契约 | `node scripts/verify-artifact.mjs` | 140 项：模块表握手、纯注册（不碰模块表）、注册 id、导出面、`inject` 面、外部请求全在平台基线内、字典、四次注册、label thunk、注入面、disposer、能力源与**配色方案源**、业务面、资源地址文法、编辑器页签、**编辑器的读写线形**、**右侧栏缺座位时的分类与修复**、**晚到能力**、资源管理器行模型与地址栏上溯、**添加流程分支表**、降级装配 |
| profile 解析 | `node scripts/check-resolution.mjs %USERPROFILE%\.dsh\profiles\web dsh-workbench` | Loader 的 bare-name 解析、Host 半可加载、`dsh.bundle`/`dsh.client` 声明、client bundle 存在 |
| **真实 Host 上线** | `node scripts/check-live-host.mjs http://127.0.0.1:43299 dsh-workbench <token>` | 跑起来的 `dsh web` 是否把插件端到端送到浏览器，以及这次启动组的是哪种目录选择交互 |
| **文件路由实测** | `node scripts/check-file-routes.mjs http://127.0.0.1:43299 <token>` | 真的在磁盘上读写一个文件：信任栅栏、只改已存在文件、版本守卫、`stale` 拒写、越界拒写、方法/媒体类型 |
| 真实装配 | 见下 | `apply()` 的真实面：取消选择不建工作区、选中即登记、Host 拒绝时把原因报出来、越界列表转成行内错误、应用内浏览器的列目录与建目录 |

### 真实 Host 上线（最强的一条）

```powershell
# 另起一个 web Host（不动正在运行的那个），它启动时会打印带 token 的地址
node D:\1_SoftWare\DeepSeek_Harness\deepseek-harness\apps\cli\lib\bin.js --profile web --port 43299 --no-open
# 复制它打印的 ?token=... ，然后：
node scripts\check-live-host.mjs http://127.0.0.1:43299 dsh-workbench <token>
```

实测结果：

```
ok  GET / answers 200 (got 200)
ok  the served page injects window.__DSH_BOOT__
ok  the boot graph names the plugin (dsh-workbench)
ok  the page preloads an application combo
ok  the page boots from a bootstrap combo
ok  the application combo lists dsh-workbench/client.js
ok  the bootstrap combo answers 200 (got 200)
ok  the combo is served as JavaScript (got text/javascript; charset=utf-8)
ok  the application combo answers 200 (got 200)
ok  the batch is module-loader closure factories
ok  the batch carries the plugin bundle entry
ok  the served bundle claims the sidebar panel row
ok  the served bundle reads the Workspace snapshot hook
ok  the served bundle lists directories through the Remote namespace
ok  the served bundle can call the Host directory picker
ok  the official sidebar is composed in the same graph as the workbench
ok  the graph names exactly one directory-picker interaction (native=true, browse=false)
ok  GET /plugins/dsh-workbench/client.js answers 200 or a by-design 404 (got 404)
OK  the running Host serves this plugin to the browser
```

这条检查同时回答了两个问题：**client-modules 扫描到了本插件的 `dsh.client` 声明**
（boot graph 的 application combo 里出现 `dsh-workbench/client.js`，而同一条 URL 也列着官方侧边栏，
说明插件与官方 UI 是在同一次组合里），以及 **served 到浏览器的字节里确实带着本插件的四处集成点**
（`sidebar.panellist` 面板行、`useWorkspaces` 全局 hook、`workspaceFiles` / `directoryPicker` 两个 Remote 命名空间）。

最后那条 `directory-picker interaction` 是**这次启动组了哪种选目录交互**的读数：
本机 CLI `dsh web` 是 `native=true`（可以用系统选择器），而 DSH Desktop 恰好相反。
它断言的是「恰好一种」——两种同时挂或都不挂都说明 picker 那一行配错了。

脚本里有两条 Host 规则值得记下来：页面只在打印出来的 `?token=` 地址上可读（trust fence 会拒绝别的客户端）；
`/plugins/??…` 是精确匹配的 URN，**加 query string 会 404**，所以必须原样取用。
另外用 `node:http` 而不是 `fetch` —— undici 会带上 `sec-fetch-mode`，被 trust fence 直接拒。

### 产物契约与 profile 解析

```
loader handshake      ok ×4
client face           ok ×9
host registration     ok ×32   (字典 + 四次注册 + 十个注入面 + 能力源与配色源 + 编辑器页签)
workspace faces       ok ×12   (两条添加路径 + 拒绝上报 + 浏览原语)
file open             ok ×14   (地址文法 + 默认走编辑器 + 缺座位分类 + 会话补位)
editor routes         ok ×13   (客户端到自建 Host 路由的线形与分类)
late capability       ok ×12   (apply 之后才挂上的服务照样到达面板)
explorer model        ok ×16   (行序、层级、展开、空/失败/截断、路径拆分与上溯)
pick flow             ok ×10   (分支表、面包屑、隐藏目录过滤)
degraded composition  ok ×12   (什么都没挂时仍挂载，报错有内容而不是静默)
共 140 项；OK  the artifact satisfies the DSH client-module contract

resolved host entry: D:\3_WorkProject\work_desk\plugins\dsh-workbench\lib\index.js
declares dsh.bundle.patch: ./cordis.patch.yml
declares dsh.client.platform: web
host half exports: apply, inject, name
OK  the plugin resolves from the profile and its host half loads
```

`workspace faces` 这组用最小宿主真的驱动了一遍插件的两条业务路径：
选择器返回 null（断言**没有**产生工作区）、返回目录（断言登记的就是那个路径）、Host 拒绝登记
（断言原因被报出来）、`pick` 被拒（断言转去应用内浏览器）、浏览原语列目录与建目录、
以及文件树列表越界（断言转成行内错误、且那行文案来自本插件命名空间而不是硬编码英文）。

`late capability` 这组是本插件那个「文件能力没挂载」缺陷的回归测试：宿主先**什么都不挂**就让 `apply` 跑完，
断言两个槽位都已注册、能力开关全为 false、此时要列表会得到一行失败级而不是缺失动作；
然后**在同一个已缓存的 inject 面上**逐个补上 `uiWorkspace` / `workspaces` / `remote.workspaceFiles` /
`remote.directoryPicker`，断言能力开关翻成 true、加号按钮背后的流程真的建了工作区、目录树真的列出了条目。
换句话说：服务晚到不再等于这个页面永远没有文件列表。

`pick flow` 这组断言的是 `pickStep()` 这张分支表本身：没有 pick 命名空间 → 走应用内浏览器、
`ok:true` + 路径 → 登记、`null`/空串 → 取消、`directory-picker/unavailable` → **走应用内浏览器**、
其它失败 → 带着 Host 原文上报；再断言面包屑（Home 标记、跨盘符时补一个 Home）与隐藏目录过滤。

`file open` 这组锁定资源地址文法与投递：Windows 盘符的 `:` 保持字面、空格与 `#`/`?` 逐段百分号编码、
POSIX 绝对路径保留前导空段（这样解码回来仍是 `/home/…`）、会话 id 也编码；
再断言双击产出的地址恰好是 `dsh-resource://file/session/<会话>/<编码路径>`，
以及「没有任何标签类型认领该地址」时的抛错被转成一行可显示的信息。

`explorer model` 这组不含 DOM，只断言 `explorerRows()` 这个纯函数的输出，也就是面板真正画的行：
目录在前的自然序、展开后子行紧跟父行且 depth+1、未列过的目录给 loading 行、失败行带着自己的文案、
空目录给空行、截断提示排在它丢掉的条目之后。

`degraded composition` 这组回答「插件为什么完全没出现」这类问题：把 `ctx.get()` 换成一个什么都不提供的宿主，
断言 `apply()` 仍然注册两个槽位、`inject` 里没有可选服务、可选动作存在但为空操作、能力开关全 false。
另外卡片网格读的是组合提供的全局 hook（`useWorkspaces`），这块抽成了一个纯函数 `workspaceItems()`，
所以「没有工作区 UI 时快照缺席」也有断言：缺席读成空网格，而不是在组件里炸掉。
换句话说，只要 `slots` 与 `locale` 在，面板就会出现在侧边栏面板列表里。

### 时序这条

`ctx.slots.inject()` 的等待语义（在侧边栏声明席位之前请求注册）有官方 DOM 测试路径作证：
`packages/client/ui-sidebar/tests/panel-list.client.spec.tsx` 用真实 `SlotRegistry` 走通了
「`main` 面板体 + `sidebar.panellist` 面板行」的两次注册，官方 `ui-settings-general`
占据 `sidebar.settings` 用的也是同一条路径。本插件照抄这条写法，不自己发明挂载点。

本仓库的 `verify-artifact.mjs` 用的是一套记录式桩（记录注销函数、字典、注册参数），
外加一个 `provide()` 能模拟「服务在 apply 之后才挂上」，所以它证明的是**注册面与能力追踪的形状**，
不证明异步等待时序本身；时序那一层靠上面的官方测试。

仍没有自动化覆盖的两件事：**在已运行的应用里热加载**（DSH 只在启动时快照客户端 bundle，
所以新插件必须重启才会出现在页面上），以及**真实的 DOM 渲染**——
本插件的组件没有被 jsdom 渲染过，行的长相、可点性与键盘行为目前只有代码与类型层面的保证。
写文件那一半不在此列：`check-file-routes.mjs` 会在真实 Host 上真的读写一个文件。

### 文件路由实测（唯一真的动磁盘的一条）

```powershell
node apps\cli\lib\bin.js --profile web --port 43299 --no-open   # 从 checkout 里起一个真 Host
node scripts\check-file-routes.mjs http://127.0.0.1:43299 <token>
```

```
ok  the tokenized page answers 200 (got 200)
ok  the page issued the session cookie the trust fence wants
ok  a caller without the session cookie is refused (got 401)
ok  a write to a file that does not exist yet is refused (got 404/workbench/not-a-file)
ok  the read route answers the file's text (got 200)
ok  the read route carries a version token
ok  a version-guarded write lands and moves the version (got 200)
ok  the file on disk carries the edited text
ok  a stale version is refused with its own code (got 409/workbench/stale)
ok  the refused write changed nothing on disk
ok  a path outside the workspace root is refused (got 403/workbench/outside-workspace)
ok  a GET on the read route is refused (got 405)
ok  a non-JSON body is refused (got 415)
OK  the workbench file routes read, write, guard, and refuse as specified
```

它会自己从 `~/.dsh/sessions` 找最新的会话、从 `~/.dsh/storages/workspace.json` 找它的工作区根，
在根里建一个临时文件跑完整流程，最后删掉。第 4、5 条是这套写路径存在的理由：
**版本对不上就不写**，**根外面就不写**——即使后端本来允许。

## 迁移状态（本机）

之前那版 MVP 把工作台直接加进官方 `ui-sidebar` 包。现在已按规范还原：

- `packages/client/ui-sidebar/src/client/index.ts` 已回到上游内容（备份文件已删除），
  `src/client/workbench/` 与其 spec 已移除，侧边栏 bundle 已重建（22.67 kB，不含 workbench 标记）；
- 被那次改动刷新的 DOM 快照已 `git checkout` 还原；
- checkout 现在只剩一处改动：`packages/client/tsdown.client.ts` 把内部 `clientConfig()` 导出，
  供包外的插件包复用官方客户端预设（这是本插件能产出合规 bundle 的前提）。改动是**纯增量**——
  一行 `function` 变 `export function` 加一段 JSDoc，没有任何行为变化；插件进上游后可以直接撤掉；
- 旧 MVP 目录 `apps/workbench/` 仍留在工作区作为记录，但它的 install 脚本**不要再跑**；
- 插件已同时装进 `web` 与 `desktop` 两个 profile（`link:` 形式）。

## 排障顺序

界面没变化时，按这个顺序定位，每一步都能把范围砍一半：

1. **profile 装了吗** —— `node scripts/check-resolution.mjs %USERPROFILE%\.dsh\profiles\<profile> dsh-workbench`
   失败就是没装或 `dsh.bundle` 没声明；成功说明 Loader 能按 bare name 解析到它。
2. **Host 送到浏览器了吗** —— `node scripts/check-live-host.mjs <url> dsh-workbench <token>`。
   失败说明问题在 Host 组装（profile 层级、bundle 列表），不在浏览器；成功那行还会打印
   **这次启动组的是哪种选目录交互**（native / browse）。
3. **浏览器执行了吗** —— 打开 DevTools Console，看有没有提到 `dsh-workbench`、`client.js`
   或某个 service 名的红字。`inject` 里出现宿主不提供的服务会让整个客户端半停在 pending，
   表现就是「界面毫无变化、也没有报错」。
4. **重启了吗** —— 客户端 bundle 只在启动时快照，必须托盘 → 退出 → 重新打开。

排查 **DSH Desktop 自己的启动图**（GUI 端口对外一律 403，但渲染进程的 Chromium HTTP 缓存里有页面原文）：

```powershell
$dir = "$env:APPDATA\DSH Desktop\Partitions\dsh-desktop-renderer\Cache\Cache_Data"
Get-ChildItem $dir -File | ForEach-Object {
  $t = [System.Text.Encoding]::ASCII.GetString([System.IO.File]::ReadAllBytes($_.FullName))
  if ($t -match '__DSH_BOOT__' -and $t -match 'dsh-workbench') { "== $($_.FullName)" }
}
# 找到那个文件后，直接搜 'directory-picker' 前缀就能看出组了哪种交互：
#   ...ui-directory-picker-browse/client.js  →  browse（本机 Desktop 就是这种，pick 会被拒）
#   ...ui-directory-picker-native/client.js  →  native
```

现版本已经把第 3 步的常见坑堵住：必需 `inject` 只剩 `slots` 与 `locale`，
其余服务（`uiWorkspace`、`workspaces`、`remote.workspaceFiles`、`remote.directoryPicker`）一律
**按调用解析 + 用 `ctx.inject` 追踪**，既不因为缺服务而半死不挂载，也不会把「apply 那一刻没挂上」冻结成永久状态。

两个已经修掉、但值得记住的现象：

- **卡片正文说文件能力没挂载** —— 来自「探一次就定死」。现在同样的文案只可能出现在真正的早期请求上，
  点一下「重新读取」就会重新解析一次服务。
- **点加号什么也不发生** —— 来自「把 reject 吞进未处理的 promise」+「假定 pick 一定可用」。
  Desktop 组的是 browse 后端，`pick` 被 Host 明确拒绝；现在那条拒绝被读成「改用应用内浏览器」，
  而真正的失败（登记被拒、目录列不出来、建文件夹失败）都会在面板顶部显示 Host 给的原因。

## 包结构

```
package.json            dsh.bundle.patch + dsh.client（platform: web）+ exports["."|"./client"]
cordis.patch.yml        profile 层补丁：只 insert 自己那一行，不覆盖任何官方行
src/index.ts            Host 半（tsc 编译后随包分发为 lib/index.js）：两条文件路由
                        POST /workbench/file/read · POST /workbench/file/write
                        —— 信任栅栏、会话工作区根边界、版本守卫、组合自己的沙箱策略
src/client/index.ts     浏览器半：注册 workbench 字典 + 占 main/workbench 面板体与 sidebar.panellist 面板行
                        + 注册右侧栏的编辑器页签 + 能力源（createCapabilityStore + ctx.inject 追踪）
                        + 按调用解析服务的动作 + 添加流程 + 编辑器页签的读写动作
src/client/Workbench.tsx        面板体（控制室）+ 面板行图标 + 工作区卡片 + FileExplorer（VS Code 形状）
src/client/WorkbenchFileEditor.tsx  右侧栏编辑器页签：读取、编辑、Ctrl+S 保存、版本冲突提示、切官方预览
src/client/WorkspaceDirectoryPicker.tsx  browse 后端下的应用内目录浏览器（面包屑 + 新建文件夹）
src/client/cards.ts            卡片本地状态机类型（CardStatus = idle | running | completed）
src/client/workspaces.ts        卡片模型、强调色、能力源、资源管理器行模型、pick 分支表、资源地址、错误码→文案
src/client/Workbench.module.css 全部样式（深色玻璃控制室 + 资源管理器 + 选择器 + 编辑器）
src/client/locales.ts           workbench 命名空间词典（zh 为准，en 对齐）
build-plugin.ps1                构建编排（暂存 → tsc（Host 半 + 客户端半）→ tsdown（浏览器半）→ 收回 lib/）
scripts/verify-artifact.mjs     产物契约 + 业务面 + 晚到能力 + 行模型 + 分支表 + 编辑器页签与线形
scripts/check-resolution.mjs    profile 解析校验
scripts/check-live-host.mjs     运行中的 Host 上线校验（含选目录交互读数）
scripts/check-file-routes.mjs   真 Host 上真读写：栅栏/边界/版本守卫/拒写
scripts/probe-running-app.mjs   对已经跑起来的应用做端口探测（诊断用；GUI 端口对非浏览器客户端一律 403）
lib/index.js           Host 半构建产物（tsc 编译，随包分发）
lib/client.js          浏览器半构建产物（随包分发）
```

## 边界

- 卡片只读工作区身份（标题、目录、会话列表、时间戳）与目录树；卡片正文不再做对话导航 —
  真正的会话视图仍是主列 `conversation` 槽位的所有权。
  卡片运行状态是**插件本地状态机**（`idle | running | completed`），不依赖 Host 运行态信号；
  状态机写在卡片组件本地，词汇固定，未来如要接真实会话/Agent 状态，只替换写入点。
- 资源管理器只列目录、不做过滤搜索；点文件只是选中，**双击在右侧栏打开编辑器**。
  右侧栏的官方 `text` 类型仍负责只读渲染（Markdown / 图片 / PDF），编辑器标题栏的 ◱ 一键切过去。
- **写文件的边界**（这一版新增，读的时候请留意）：保存会**真的改你磁盘上的文件**。
  三道闸都在 Host 侧：只改**已存在的普通文件**（不新建、不跟随末段符号链接）、
  路径必须落在**该会话的工作区根**内、**版本必须仍是编辑器读到的那一个**。
  沙箱策略用组合自己解析的那份（含会话 override），所以 `read-only` 部署下保存会被沙箱拒绝。
  版本对不上时编辑器**不覆盖**，而是提示先「重新读取」。
- 编辑器是**纯文本**的：没有语法高亮、没有行内 diff、没有撤销栈持久化（只靠浏览器的输入撤销）。
  大文件（> 2 MiB）与含 NUL 的二进制文件拒读，转成一行提示 + 「用官方预览打开」。
- 右侧栏的座位绑在**当前会话**上：若此时没有会话在屏（纯空白视图），
  `openResource` / `openTab` 会回「no session surface is mounted」，本插件把这行原文显示在面板顶部。
- 应用内目录浏览器是**本插件自己的**，不是官方那个对话框：官方交互占着 ui-workspace 的两个单席位，
  且由侧边栏/会话菜单的局部 state 打开，没有对外服务可唤起。因此它的长相与官方对话框不完全一致，
  复用的是同一组 Host 浏览原语；**地址栏是本插件加的**（官方那个对话框反过来只能按层点，不能输路径）。
- **为什么 Desktop 上没有系统目录对话框**：一次启动只组一种选目录交互，`directory-picker-auto`
  在启动时按 bind host / SSH 标记 / 显示会话解析一次；Desktop 那次解析成 `browse`，
  于是 `directoryPicker/pick` 会被 Host 明确拒绝，官方那条「Add workspace…」在 Desktop 上同样是浏览式对话框。
  插件没有在 Host 侧再补一个 PowerShell 选择器：这台机器只有 Windows PowerShell 5.1（没有 pwsh 7），
  而 5.1 的 `FolderBrowserDialog` 正是上游**刻意删掉**的那一级（旧的 `SHBrowseForFolder` 树 + DPI 问题，
  且它也没有地址栏）。想要真正的现代 Windows 目录对话框，就在 Windows 上跑一个 loopback 的
  `dsh web` 宿主（`check-live-host.mjs` 会打印这次启动组的是哪种交互）。
- 卡片用第一个会话当 scope，所以**刚登记、还没有会话的工作区**只能看到提示；
  这是 Host `list` 的鉴权模型决定的，不是可以绕过的实现细节。
- 选择器每次打开都回到主目录，也不记忆上次位置。
- 没有卡片拖拽排序（工作区顺序仍在侧边栏里排）、没有展开状态持久化：
  展开集合与已列层级都活在卡片组件的 state 里，切走再回来就是全折叠。
- 嵌套递归有 `MAX_EXPLORER_DEPTH = 32` 的硬上限（符号链接成环时不会无限展开）。
- Host 半是两条文件路由，不提供 service/tool；也不注册命令。
- 分发只做到 **tarball 与 git 仓库**两种（见「装到另一台电脑」）；面向 npm 的发布
  （去 `private`、抢 `dsh-workbench` 这个名字、README 双语）尚未做。
