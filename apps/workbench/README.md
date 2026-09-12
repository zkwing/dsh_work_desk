# 可视化工作台（Workbench MVP，已归档）

> **已被独立插件取代，本目录仅作记录。** 同一套界面现在是可独立安装的 DSH 插件：
> [`../../plugins/dsh-workbench`](../../plugins/dsh-workbench/README.md)，同时兼容普通 `dsh web` 与 DSH Desktop，
> 且不修改任何官方包。
>
> 迁移已经做完：`ui-sidebar` 已还原并重建、相关快照已还原、新插件已装进 `web` profile。
> **不要再运行本目录的 `install-workbench.ps1`** —— 它会把工作台塞回官方侧边栏，与插件冲突（底部出现两个入口）。
>
> 预览服务器仍然可用，它加载的是侧边栏 bundle 里的那一版组件，不是插件版本。

侧边栏底部多了一个入口，点开是一个覆盖式「控制室」：本地读数条 + 用户自定义项目卡片。
所有代码都跑在 DSH 的侧边栏插件里，不新增插件行、不改 profile、不改前端 dist。

```
apps/workbench/
  README.md                  本文件
  install-workbench.ps1      一键安装 + 构建 + 校验
  dsh/                       插件源码（拷进 ui-sidebar）
    state.ts                 项目数据模型、localStorage 持久化、读数派生
    Workbench.tsx            侧边栏底部触发器 + 控制室（真实组件）
    Workbench.module.css     全部样式（深色玻璃质感控制室）
    locales.ts               workbench 命名空间的中英词典
    index.ts                 对外出口
  patch/
    ui-sidebar.index.ts      替换版 ui-sidebar/src/client/index.ts（含 workbench 注册）
    workbench.client.spec.tsx 走真实装配路径的 3 个测试
  preview/                   离线预览（加载真实构建产物 lib/client.js）
    index.html               预览页
    main.js                  预览宿主：模块表 + 三块侧边栏场景
    serve.mjs                预览服务器（含 React 18 的浏览器端 CJS 加载器）
    stubs/                   仅预览用的三个模块表替身
    check-imports.mjs        预览依赖图静态检查
```

## 现在就能看：离线预览

预览页加载的是**插件构建产物本身**（`packages/client/ui-sidebar/lib/client.js`），
不是另写一份 UI，所以看到的就是应用里的那个组件。

```powershell
node D:\3_WorkProject\work_desk\apps\workbench\preview\serve.mjs --port 43121
```

然后打开 <http://127.0.0.1:43121/>。页面有三块场景：

1. **折叠态**：侧边栏 rail 里的 36×36 入口；
2. **展开态 · 空工作台**：点开是控制室空状态（引导新建第一张卡片）；
3. **展开态 · 已有项目**：已自动打开控制室，带 3 张示例卡片（Orion / Halley / Vega），
   可以直接改名称、目录、进度、状态、配色 —— 数据写进浏览器 localStorage。

按 `Esc` 或点背景关闭。预览只用本机文件，不联网（React 18 没有 ESM 构建，
`serve.mjs` 里带一个浏览器端 CommonJS 加载器把 `react` / `react-dom/client` 包成 ESM）。

## 装进 DSH（看到侧边栏里的真身）

插件已经装好并构建过一次（写进 DSH checkout），但**运行中的 DSH 进程只在启动时读取一次客户端 bundle**，
所以要重启 DSH Desktop 才能看到。之后想改样式/文案，重新构建 + 重启即可。

```powershell
# 安装（拷贝源码 + 备份 index.ts + tsc -b + tsdown + 校验产物）
powershell -ExecutionPolicy Bypass -File D:\3_WorkProject\work_desk\apps\workbench\install-workbench.ps1

# 只看计划
powershell -ExecutionPolicy Bypass -File ...\install-workbench.ps1 -DryRun

# 只拷源码不构建
powershell -ExecutionPolicy Bypass -File ...\install-workbench.ps1 -SkipBuild

# 还原（恢复 ui-sidebar 的 index.ts 备份）
powershell -ExecutionPolicy Bypass -File ...\install-workbench.ps1 -Uninstall
```

默认 checkout 是 `D:\1_SoftWare\DeepSeek_Harness\deepseek-harness`，用 `-Checkout <路径>` 覆盖。

安装脚本动到的文件（全部在 checkout 内，不碰 `$DSH_HOME`）：

| 路径 | 动作 |
| --- | --- |
| `packages/client/ui-sidebar/src/client/workbench/*` | 新增 |
| `packages/client/ui-sidebar/src/client/index.ts` | 先备份为 `index.ts.workbench-backup`，再替换 |
| `packages/client/ui-sidebar/tests/workbench.client.spec.tsx` | 新增 |
| `packages/client/ui-sidebar/lib/types/**` | tsc 产物（增量） |
| `packages/client/ui-sidebar/lib/client.js(.map)` | tsdown 产物，侧边栏自己的 bundle |

**重启步骤**：完全退出 DSH Desktop（含托盘），重新打开。重启后看侧边栏底部的「工作台 / Workbench」入口。
不需要重建 `apps/web/dist` —— 插件 bundle 由 Host 在 `/plugins/<包名>/client.js` 提供，属于运行时加载。

## 已做的验证

| 验证 | 结果 |
| --- | --- |
| `tsc -b packages/client/ui-sidebar` | 通过（0 error） |
| `tsdown --env.DSH_BUILD_FACE client` | 通过，`lib/client.js` 63.2 kB，含 workbench 与内联样式 |
| `vitest run packages/client/ui-sidebar/tests/workbench.client.spec.tsx` | **3 passed** |
| `vitest run packages/client/ui-sidebar`（整个包） | 482 passed；仅刷新了 3 个 DOM 快照（侧边栏底部多了入口按钮属预期变更）；1 个既有失败 `pdf-license-bundle` 与本次改动无关（产物未重建） |
| 预览页（无头 Edge 实渲染） | 控制室渲染成功：`Control Room` 标题、4 个读数、3 张示例卡片、进度条、中英切换，无控制台报错 |

那 3 个测试走的是真实装配路径（`SlotTestRuntime` + 真实 `ui-sidebar` apply）：

- 触发器落在 `sidebar.footer.action` 席位（`id: workbench`, `order: 10`，label thunk 随语言变化）；
- 点开控制室 → 新建项目 → 卡片出现且写入 `localStorage`；
- `locale.setLocale('en')` 后同一 fiber 上文案变英文，无需重新注册；
- 已持久化的 roster 能恢复（读回名称、目录、进度 75%）。

## 设计说明

- **入口**：`sidebar.footer.action`（ui-sidebar 声明的列表席位，Settings 上方）。
  这是 DSH 为「侧边栏底部附加动作」预留的扩展点，所以工作台和 shell 是插槽关系，不是 fork。
- **控制室**：`position: fixed; inset: 0; z-index: 3000` 的覆盖层（`ui-settings-general` 的全屏面板同款做法），
  侧边栏折叠动画期间会裁切子树，所以不进 DOM 子树、也不用 portal（ui-sidebar 没有 react-dom 依赖）。
- **视觉**：深色玻璃面板 + 双层径向光晕 + 32px 工程网格 + 强调色轨道，
  正文用 4 个 token 化的读数卡；配色 token 用 `ui-theme` 的 `--dsw-*`，所以明暗主题都成立。
- **数据**：项目 roster 完全本地（`localStorage: dsh.workbench.v1`），读数全部由 roster + 挂钟派生，
  没有伪造遥测，也不写会话日志。项目字段：名称 / 目录 / 说明 / 完成数 / 总数 / 下一步 / 状态 / 配色。
- **文案**：全部走 `workbench` 命名空间词典（zh 为准，en 对齐），没有硬编码 UI 文案。

## MVP 边界（明确没做的）

- 项目卡片**不自动绑定 DSH workspace/session**：现在是你手填目录与本机进度；
  后续可以读 `ctx.get('uiWorkspace')` 把真实 workspace 列表映射成卡片。
- 没有拖拽排序、没有卡片级任务列表、没有跨设备同步（localStorage 是本机的）。
- 控制室不提供「直接启动会话」的动作 —— MVP 只做可视化与记录。
- 没有为 repo 的 `verify-client-ui-i18n` / 快照门禁补文档与 Agent Note；
  这是本地 mvp 改动，不是可直接提交上游的 PR。

## 卸载

```powershell
powershell -ExecutionPolicy Bypass -File ...\install-workbench.ps1 -Uninstall
# 然后重建 bundle 并重启 DSH Desktop：
#   tsc -b packages/client/ui-sidebar
#   tsdown --env.DSH_BUILD_FACE client   （在 packages/client/ui-sidebar 下）
```
