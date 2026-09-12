# work_desk

DSH（DeepSeek Harness）插件工作区。

```
plugins/dsh-workbench/    工作台插件：全局面板 + 工作区卡片 + VS Code 形状资源管理器 + 可编辑的右栏文件视图
apps/workbench/           最早那版 MVP（已归档，只作记录，install 脚本不要再跑）
```

## plugins/dsh-workbench

侧边栏面板列表里多一行「工作台」，选中它把中列换成控制室：**一张卡片就是一个工作区**，
卡片可在「对话」与「文件」间切换，资源管理器里双击文件会在对话视图右侧栏打开编辑器（可改、Ctrl+S 保存）。
同时运行在普通 `dsh web` 与 DSH Desktop 上。细节见 [`plugins/dsh-workbench/README.md`](plugins/dsh-workbench/README.md)：
四条硬约束、46/137 项产物契约、四层验证脚本、排障顺序。

### 在另一台电脑上安装

`lib/`（Host 半、浏览器半、类型声明）已随仓库提交，因此目标机器**不需要 DSH checkout，也不需要构建**。

```powershell
# 方式一：克隆后按本地路径安装（最稳）
git clone git@github.com:zkwing/dsh_work_desk.git
dsh plugin --profile web add .\dsh_work_desk\plugins\dsh-workbench

# 方式二：直接从仓库安装（pnpm 的 #path: 子目录选择器）
dsh plugin --profile web add "github:zkwing/dsh_work_desk#path:plugins/dsh-workbench"

# 校验那一行进了配置树，然后重启宿主/应用
dsh --profile web --dump-config | Select-String workbench
```

- Desktop 用 `--profile desktop`，且必须用**应用自带的** `dsh`（PATH 上那个 shim）；
  checkout 里的 CLI 会拒绝 `desktop` 这个 profile 名。
- 目标机器 DSH 版本需满足插件的 `engines.dsh`（`>=0.1.5-rc.1`）。
- 装完必须重启：Host 半只在启动时装载，客户端 bundle 也是启动时快照。
- 自包含的离线安装包：在插件目录 `pnpm pack` 得到 `dsh-workbench-<version>.tgz`，
  拷过去用 `dsh plugin --profile <p> add .\dsh-workbench-<version>.tgz`。

## apps/workbench

第一版把工作台直接加进官方 `ui-sidebar` 包的 MVP，已被 `plugins/dsh-workbench` 取代。
`install-workbench.ps1` 会改写官方包，**不要再运行**；里面的 `preview/` 只是当时的浏览器预览壳。

## 开发与验证

```powershell
# 构建（需要 DSH checkout：<checkout>\packages\plugins\dsh-workbench 会被重新暂存、编译、收回）
powershell -ExecutionPolicy Bypass -File plugins\dsh-workbench\build-plugin.ps1
# 产物契约（137 项，含晚到能力、行模型、编辑器页签、地址文法）
node plugins\dsh-workbench\scripts\verify-artifact.mjs
# profile 解析 / 真实 Host 上线 / 文件路由实测
node plugins\dsh-workbench\scripts\check-resolution.mjs %USERPROFILE%\.dsh\profiles\web dsh-workbench
node plugins\dsh-workbench\scripts\check-live-host.mjs http://127.0.0.1:43299 dsh-workbench <token>
node plugins\dsh-workbench\scripts\check-file-routes.mjs http://127.0.0.1:43299 <token>
```

构建依赖 checkout 里被导出出来的 `packages/client/tsdown.client.ts` 的 `clientConfig()`
（插件是 out-of-tree 包，必须复用官方客户端预设），所以**构建只在本机做，产物随仓库分发**。
