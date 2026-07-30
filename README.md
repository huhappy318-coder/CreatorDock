# CreatorDock

[中文](#中文) · [English](#english)

CreatorDock is a local-first, installable launchpad for creators who manage
multiple publishing destinations. It keeps account labels, URLs, ordering, and
optional Windows browser-profile shortcut settings in the browser. It does not
hold the accounts themselves.

## 中文

### 产品定位与预览

CreatorDock 是一个静态、可安装的创作者工作台：把多个平台、多个账号的入口集中在同一处，同时让同平台账号保持独立。普通卡片始终以隔离的外部链接打开；选择 Chrome、Edge 或 profile directory 只影响导出的 Windows 快捷方式。

本地预览：

```powershell
npm ci
npm run dev
```

打开 Vite 输出的本地地址。正式交接截图建议使用 1440×900 桌面视口，并至少展示：

- 首页全貌和分类侧栏；
- 同一平台的两个不同账号卡片；
- 搜索或紧凑密度状态；
- “添加目标”对话框。

截图可放在 `docs/images/`，文件名建议为 `creatordock-overview.png`；提交前检查截图中没有私人账号名、浏览器资料、Cookie、Token 或其他敏感信息。

### 安装、开发、测试与生产构建

前置条件：Node.js 20 或更高版本、npm，以及在 Windows helper 场景下的 Windows PowerShell 5.1 或 PowerShell 7。

```powershell
# 严格按 package-lock.json 安装
npm ci

# 开发服务器
npm run dev

# unit/component tests
npm test

# TypeScript 检查
npm run typecheck

# 生产构建和静态产物检查
npm run build
npm run check:dist

# 构建 /CreatorDock/ base path，启动 127.0.0.1:4174，
# 等待 HTTP 就绪，运行真实 Chromium E2E，并只停止它自己启动的 preview
npm run test:e2e
```

`dist/` 是静态生产产物。`npm run test:e2e` 会重新生成生产构建，不应与其他服务共用端口 4174。

### 在 Chrome 与 Edge 中安装 PWA

先从 HTTPS 部署地址或本地生产 preview 打开 CreatorDock。

- Chrome：地址栏右侧选择“安装 CreatorDock”，或打开菜单 →“投放、保存和分享”→“安装网页应用”。
- Edge：地址栏右侧选择“应用可用”，或打开菜单 →“应用”→“将 CreatorDock 安装为应用”。
- 若浏览器没有显示安装入口，确认页面通过 HTTPS 或 loopback 地址访问、manifest 返回 200、图标可访问，并且浏览器允许安装。

PWA 只缓存 CreatorDock 应用壳；外部创作平台不会被离线缓存。

### 配置备份、导入与隐私边界

“Export configuration”导出完整配置，包括账号标签、URL、分组、顺序、主题、密度、浏览器选择、profile directory 名称和快捷方式开关。“Export shortcut file”只导出 Windows helper 所需字段。导入只接受符合当前 schema 的 JSON；无效导入不会覆盖当前有效配置。

配置默认保存在当前浏览器 origin 的 `localStorage`，不会自动上传。导出文件可能暴露账号标签、工作流结构和访问 URL，请按私人文件管理。CreatorDock 不读取或保存密码、Cookie、Token、登录状态、浏览器账号身份或浏览器资料内容。

### 多模型写作与个人风格

首页的“写作实验室”是可选能力。你可以添加多个 OpenAI 兼容、DashScope、Gemini 或 Anthropic 模型，填写自己的 Base URL、模型 ID 和 API Key；模型元数据保存在本机，API Key 使用你设置的本机解锁口令通过 PBKDF2 + AES-GCM 加密。口令只存在当前页面内存中，不会保存、上传或写入导出文件。

每次生成会按固定顺序组合任务、当前风格描述、`.txt/.md` 样本、可编辑的去 AI 味规则和任务要求。样本仅作风格参考，不会被当作指令。可以创建多个风格、随时切换或临时关闭风格规则，并维护禁用词与必须习惯。

请求由浏览器直接发送到你填写的服务地址；项目不提供代理、额度、账号或内置 Key。部分服务商的浏览器跨域策略可能阻止直连，这属于服务商配置边界，CreatorDock 不绕过 CORS，也不会把 Key 发到项目服务器。使用“导出 AI 配置”时只导出模型元数据和 `hasApiKey` 标记，导入后需要重新填写 Key。

### Windows 本地 launcher 与快捷方式 helper

先安装依赖并完成构建：

```powershell
npm ci
npm run build
```

长期本地使用：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Start-CreatorDock.ps1
```

launcher 固定使用 `http://127.0.0.1:4173/`。如果该端口已经返回经过标记校验的 CreatorDock 页面，它会复用并打开；如果端口由其他服务占用，它会报错并拒绝终止或替换该进程。没有可复用服务时，它只启动仓库内 Vite 的隐藏 production preview，并在 HTTP 验证通过后用默认浏览器打开。

从 UI 导出 `creatordock-shortcuts.json` 后，先运行自测，再创建快捷方式：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\New-CreatorDockShortcuts.ps1 -SelfTest

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\New-CreatorDockShortcuts.ps1 `
  -InputPath .\creatordock-shortcuts.json `
  -OutputDirectory "$env:USERPROFILE\Desktop"
```

helper 检测本机 Chrome 和 Edge 的可执行文件，并只枚举形如 `Default` 或 `Profile N` 的 profile directory 名称。它不会打开浏览器配置文件，也不会读取账号身份。`Default` 只是浏览器目录名，不能据此推断其中登录了哪个账号。若要绑定其他 profile，必须由用户根据自己的浏览器目录选择；CreatorDock 不替用户识别账号。

### 平台 preset 验证状态维护

平台入口位于 `src/catalog.ts`。维护时：

1. 只使用平台官方域名或官方公开文档作为证据；
2. 能直接验证目标入口时标记为 `verified`；
3. 超时、需要登录或无法公开确认时保留 `unverified`，并在 `verificationNote` 里写清边界，不猜测；
4. 不登录、不读取账号数据、不收集 Cookie 或 Token；
5. 修改后运行 `npm test`、`npm run typecheck`、`npm run build` 和 `npm run test:e2e`。

### GitHub Pages 部署

仓库包含 `.github/workflows/pages.yml`。在 GitHub 仓库 Settings → Pages 中把 Source 设为 **GitHub Actions**。workflow 会：

- 对 push 和 pull request 执行 lockfile 安装、unit/component、type、build、静态产物和浏览器 E2E；
- 按仓库名配置 Pages base path（`*.github.io` 仓库使用 `/`）；
- 每次上传可下载的 `dist/` 验证产物；
- 只有 push 到 GitHub 配置的默认分支时才上传 Pages artifact 并部署。

本项目不会自动创建 remote，也不会从本地脚本 push。

### 明确不做的事

CreatorDock v1 不提供登录或凭据管理、自动发布、平台 analytics、云同步、浏览器 extension、Electron 或 Tauri 应用。它也不替用户操作平台账号、识别浏览器 profile 中的账号，或绕过平台认证。

## English

### Positioning and preview

CreatorDock is a static, installable creator workbench for keeping multiple
platform and account destinations distinct. Web cards remain isolated external
links. Chrome, Edge, and profile-directory choices apply only to exported
Windows shortcuts.

For a local development preview:

```powershell
npm ci
npm run dev
```

For handoff screenshots, use a 1440×900 desktop viewport and capture the full
workbench, two accounts on the same platform, a filtered or compact state, and
the add-destination dialog. Store approved images under `docs/images/` (for
example, `creatordock-overview.png`) only after checking that no private account
labels, browser details, cookies, tokens, or other secrets are visible.

### Install, develop, test, and build

Prerequisites are Node.js 20 or newer and npm. Windows helper workflows also
need Windows PowerShell 5.1 or PowerShell 7.

```powershell
npm ci
npm run dev
npm test
npm run typecheck
npm run build
npm run check:dist
npm run test:e2e
```

`npm run test:e2e` builds the production site for `/CreatorDock/`, starts Vite
preview on the explicit loopback port `127.0.0.1:4174`, waits for a verified
HTTP response, runs real Chromium checks, and stops only the preview process it
spawned. The static production artifact is `dist/`.

### Install the PWA in Chrome or Edge

Open CreatorDock from an HTTPS deployment or a loopback production preview.

- Chrome: use the install icon in the address bar, or Menu → Cast, save, and
  share → Install page as app.
- Edge: use the available-app icon in the address bar, or Menu → Apps → Install
  CreatorDock.
- If the install affordance is absent, confirm that the page is served from
  HTTPS or loopback, the manifest and icons return HTTP 200, and installation
  is allowed by browser policy.

Only the CreatorDock application shell is cached. Third-party creator
destinations are not cached for offline use.

### Backup, import, and privacy boundary

The full configuration export contains labels, URLs, groups, order, theme,
density, browser choices, profile-directory names, and shortcut flags. The
shortcut-only export contains only fields consumed by the Windows helper.
Invalid imports retain the current valid configuration.

Configuration stays in `localStorage` for the current browser origin unless
the user explicitly downloads or imports JSON. Export files can reveal labels,
workflow structure, and destination URLs, so treat them as private files.
CreatorDock never reads or stores passwords, cookies, tokens, login state,
browser account identity, or browser-profile contents.

### Multi-model writing and personal style

The optional “Writing lab” supports multiple OpenAI-compatible, DashScope,
Gemini, and Anthropic profiles. Users supply the provider URL, model ID, and
their own key. A key is encrypted locally with a user-provided passphrase using
PBKDF2 + AES-GCM; the passphrase is never persisted, exported, logged, or sent
to a CreatorDock server. Browser requests go directly to the supplied URL, so
provider CORS rules still apply and CreatorDock includes no proxy, quota,
account, or built-in key.

Writing requests use one prompt pipeline: task, style description, `.txt/.md`
samples, editable anti-AI rules, then task requirements. Samples are labeled as
stylistic references rather than instructions. Style presets can be switched or
temporarily disabled, with forbidden words and required habits editable in the
same panel. AI exports contain model metadata and a `hasApiKey` flag only;
imported profiles require the key to be entered again.

### Durable Windows launcher and shortcut helper

Install dependencies and create a production build:

```powershell
npm ci
npm run build
```

Start the durable local launcher:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Start-CreatorDock.ps1
```

It uses `http://127.0.0.1:4173/`. A process is reused only when an HTTP request
verifies the CreatorDock page. An unrelated process on that port is never
killed or replaced. Otherwise the script starts the repository-local Vite
production preview as its own hidden process, waits for readiness, and opens
the verified URL in the default browser.

After exporting `creatordock-shortcuts.json`, self-test before writing real
shortcuts:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\New-CreatorDockShortcuts.ps1 -SelfTest

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\New-CreatorDockShortcuts.ps1 `
  -InputPath .\creatordock-shortcuts.json `
  -OutputDirectory "$env:USERPROFILE\Desktop"
```

The helper detects installed Chrome and Edge executables and enumerates only
directory names such as `Default` or `Profile N`. These are directory
identifiers, not account identities. CreatorDock does not inspect the profile,
decide which account it contains, or log in.

### Maintaining platform verification status

Presets live in `src/catalog.ts`. Use official domains or public platform
documentation as evidence. Mark a preset `verified` only when its destination
can be confirmed. When a request times out, requires login, or cannot be
confirmed publicly, retain `unverified` and explain the evidence boundary in
`verificationNote`. Never log in or collect account data during maintenance.
Run the unit, type, build, artifact, and E2E gates after changes.

### Deploying to GitHub Pages

Set Settings → Pages → Source to **GitHub Actions**. The workflow in
`.github/workflows/pages.yml` uses `npm ci`, validates pushes and pull requests,
sets the repository-specific Pages base path, and uploads `dist/` as a
downloadable artifact. The Pages artifact and deployment jobs run only for a
push to GitHub's configured default branch. A `*.github.io` repository uses
the root base path.

No local script creates a remote or pushes the repository.

### Explicit non-goals

CreatorDock v1 does not provide platform login or credential management,
publishing, platform analytics, cloud sync, a browser extension, Electron, or
Tauri. The optional AI key is user-supplied and locally encrypted; it is not a
platform credential and is never sent to a CreatorDock server. The app does not
operate platform accounts, identify accounts inside browser profiles, or bypass
platform authentication.

## License

[MIT](LICENSE)
