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

打开 Vite 输出的本地地址。桌面版首次启动按当前显示器工作区的 50% 居中显示，宽高限制在 820–1000 × 560–720；不会自动最大化。标题栏保留系统最大化能力，应用内可切换“左侧悬浮 / 恢复普通窗口”并恢复默认小窗。正式交接截图建议展示左右两栏工作台，并至少包含：

- 首页左右两栏和入口搜索；
- 同一平台的两个不同账号卡片；
- 搜索或紧凑密度状态；
- “添加入口”对话框。

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

### Windows 与 macOS 桌面安装

GitHub Releases 会按操作系统提供安装包：

- Windows 下载 NSIS `.exe`。安装结束后会自动在当前用户桌面创建 `CreatorDock.lnk`；如果同名文件属于其他程序，安装器会使用带后缀的名称。
- macOS 下载通用架构 `.dmg`，将 CreatorDock 拖入“应用程序”。首次打开后可以在“偏好设置”中创建或移除桌面别名。
- v1 未签名，Windows SmartScreen 或 macOS Gatekeeper 可能显示安全提示；这是发行边界，不要下载来路不明的替代文件。

本地构建桌面壳需要 Rust、Windows MSVC Build Tools（Windows）或 Xcode Command Line Tools（macOS）：

```powershell
npm run tauri:info
npm run tauri:dev
npm run tauri:build
```

浏览器版和桌面版使用同一份版本化 JSON。桌面应用不会自动读取浏览器 `localStorage`，请在浏览器导出并在桌面版导入；导出文件不包含登录凭据、Cookie、Token 或 API Key。

### 平台图标素材

`public/icons/creator-dock-sprite.png` 是一张带文字标签的 4×4 素材图，包含 CreatorDock、首批平台、AI Writing 和 Custom Site。切片脚本会规整到 2048×2048，保留 16 个切片，并为扩展平台生成 21 个同风格品牌色抽象图标，最终验证 37 张 512×512 PNG：

```powershell
npm run icons:slice
npm run test:icons
```

卡片同时显示图标和平台名称，避免只依赖抽象符号辨认。

### 配置备份、导入与隐私边界

设置区默认使用中文，也可以切换到 English；语言选择会和主题、密度一起保存。“Export configuration”导出 schema v2 完整配置，包括界面语言、账号标签、URL、顺序、主题、密度、浏览器选择、兼容旧快捷方式的 profile directory 名称和快捷方式开关，但不再包含分类。“Export shortcut file”仍使用 Windows helper 兼容格式。导入 v1 时会删除旧分类并保留账号、URL、浏览器、Profile 和快捷方式设置；无效导入不会覆盖当前有效配置。

首次打开只展示小红书、微信公众号、哔哩哔哩、抖音和 X/Twitter 五个常用平台，并额外提供两个公众号账号入口；其他平台不会挤满首页，用户可以通过“添加入口”自行增加、编辑或删除。

“添加入口”提供可搜索的 34 个国内外创作平台预设，支持中文名、英文名和常见简称，并优先填写发布页、上传页或创作者后台；仍可改成任意安全的 HTTP(S) 网址。普通表单不显示分类和浏览器 Profile，勾选快捷方式后才显示默认浏览器、Chrome 或 Edge；旧 Profile 数据会继续保留用于高级快捷方式导出。

配置默认保存在当前浏览器 origin 的 `localStorage`，不会自动上传。导出文件可能暴露账号标签、工作流结构和访问 URL，请按私人文件管理。CreatorDock 不读取或保存密码、Cookie、Token、登录状态、浏览器账号身份或浏览器资料内容。

### 多模型写作与个人风格

首页右侧的“AI 写作”只保留写作任务框和三个独立入口：“写作风格与去 AI 味”“写作 Skill”“封面生成”。顶部“模型设置”弹窗只管理模型、Base URL、模型 ID、API Key、连接测试和配置导入导出，不再混入风格与 Skill。你可以添加多个 OpenAI 兼容、DeepSeek、通义千问、智谱 GLM、Kimi、MiniMax、豆包/火山方舟、百川、腾讯混元、硅基流动、Gemini 或 Anthropic 模型；模型元数据保存在本机，API Key 使用你设置的本机解锁口令通过 PBKDF2 + AES-GCM 加密。口令只存在当前页面内存中，不会保存、上传或写入导出文件。

每次生成会按固定顺序组合任务、当前风格描述、`.txt/.md` 样本、可编辑的去 AI 味规则和任务要求。样本仅作风格参考，不会被当作指令。可以创建多个风格、随时切换或临时关闭风格规则，并维护禁用词与必须习惯。

请求由浏览器直接发送到你填写的服务地址；项目不提供代理、额度、账号或内置 Key。部分服务商的浏览器跨域策略可能阻止直连，这属于服务商配置边界，CreatorDock 不绕过 CORS，也不会把 Key 发到项目服务器。使用“导出 AI 配置”时只导出模型元数据和 `hasApiKey` 标记，导入后需要重新填写 Key。

模型下拉目录同时提供“自定义型号”。内置型号只是无 Key 时的起始参考；要获取服务商当天实际可用的最新型号，请在“模型设置”填入对应 API Key 后点击“从平台刷新型号”。OpenAI 兼容、DeepSeek 和 Anthropic 使用服务商的 `/models` 列表，Gemini 使用官方 `models.list`；请求从本机直接发往你填写的接口，不经过 CreatorDock。若服务商关闭浏览器跨域或不提供列表接口，可直接选择“自定义型号”输入模型 ID。

模型设置、写作风格、Skill 和封面接口都会以可移动、可调整大小的浮窗打开：拖动标题栏移动，拖动右下角调整尺寸；右侧 AI 写作与封面工作区仍保留在主界面。

### Skill 建议与封面生成

在独立的“写作 Skill”入口里可以从公开 GitHub 的 `SKILL.md` 导入 Skill，也可以上传本地 Markdown 文件。Skill 会保存在本机，可启用、停用和删除；它只会作为结构、标题、平台适配或封面方向的建议参考，不会被执行、代替用户发文，也不会自动发布内容。导入只允许 HTTPS 的 `github.com` / `raw.githubusercontent.com`，单个 Skill 限制为 120,000 字符。

“封面生成”会打开独立的视觉工作区。用户可以选择 1:1、4:5、3:4、16:9、9:16、2:3 比例、预设风格、负面提示词和最多 3 张参考图，并在“封面设置”中填写自己的图片 API、模型 ID 和 API Key。负面提示词会作为明确规避要求合并进标准 prompt，不擅自发送未标准化字段；“生图 / 自定义接口”只提供兼容入口，不猜测未提供文档的私有协议。图片 Key 同样使用本机口令加密，不上传到 CreatorDock，也不会自动发布。

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

CreatorDock v1 不提供登录或凭据管理、自动发布、平台 analytics、云同步、浏览器 extension 或 Electron。Tauri 只负责桌面窗口、安装包、桌面入口和本地配置，不替用户操作平台账号、识别浏览器 profile 中的账号，或绕过平台认证。

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

On first launch, the desktop shell centers a window at half of the current work
area, constrained to 820–1000 × 560–720. It keeps native maximize support and
adds Float left, Restore window, and Reset small window controls. For handoff screenshots, capture both
columns, two accounts on the same platform, a filtered or compact state, and
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

### Windows and macOS desktop installation

GitHub Releases provides one installer per operating system:

- Windows: download the NSIS `.exe`. The installer creates `CreatorDock.lnk`
  on the current user's Desktop. If that name belongs to another file, it uses
  a suffixed name instead of overwriting it.
- macOS: download the universal `.dmg`, drag CreatorDock to Applications, then
  create or remove the optional Desktop alias from Preferences.
- v1 packages are unsigned, so SmartScreen or Gatekeeper may show a warning.
  This is expected for this release and is not a reason to download alternate
  binaries.

Desktop development requires Rust plus Windows MSVC Build Tools or macOS Xcode
Command Line Tools:

```powershell
npm run tauri:info
npm run tauri:dev
npm run tauri:build
```

The browser PWA and desktop app share the same versioned JSON configuration
format. The desktop app does not silently read browser `localStorage`; export
the configuration in the browser and import it in the desktop app. Exports do
not contain login credentials, cookies, tokens, or API keys.

The default workbench starts with five common platforms (Xiaohongshu, WeChat
Official Accounts, Bilibili, Douyin, and X/Twitter) plus two WeChat Official
Accounts entries:
`公众号·账号一` targets Chrome's `Default` profile and
`公众号·账号二` targets Edge's `Default` profile. They are shortcut-enabled
by default, and can be renamed, disabled, or duplicated like any other entry;
the profile names are only browser directory selectors, not account identities.

Add destination searches 34 domestic and international creator presets by
Chinese name, English name, or common alias, and fills a publishing, upload, or
creator-console URL where available. Any safe HTTP(S) URL remains editable.
Category and profile-directory fields stay out of the normal form; the browser
selector appears only when shortcut export is enabled, while legacy profile
data remains available to the advanced Windows helper.

### Platform icon assets

`public/icons/creator-dock-sprite.png` is a labeled 4×4 sprite containing
CreatorDock, the first platform set, AI Writing, and Custom Site. The slicing
script keeps those sixteen tiles and generates twenty-one matching abstract
brand-color icons. The final check validates thirty-seven 512×512 PNG assets:

```powershell
npm run icons:slice
npm run test:icons
```

Cards render the icon and the user-facing entry name; platform categories and
shortcut metadata stay out of the main surface.

### Backup, import, and privacy boundary

The settings panel defaults to Chinese and can switch to English. The choice is
saved together with theme and density. The full configuration export contains
the language, labels, URLs, order, theme, density, browser choices, legacy-compatible profile-directory names, and shortcut flags. Schema v2 no longer stores categories. The
shortcut-only export contains only fields consumed by the Windows helper.
Invalid imports retain the current valid configuration.

Configuration stays in `localStorage` for the current browser origin unless
the user explicitly downloads or imports JSON. Export files can reveal labels,
workflow structure, and destination URLs, so treat them as private files.
CreatorDock never reads or stores passwords, cookies, tokens, login state,
browser account identity, or browser-profile contents.

### Multi-model writing and personal style

The optional “AI writing” workspace keeps the task box on the home surface and
shows three focused entries for writing style/humanization, Writing Skill, and
cover generation. The “Model settings” dialog contains model connection fields
only. It
supports multiple OpenAI-compatible, DeepSeek, DashScope, GLM, Kimi, MiniMax,
Doubao/Volcengine, Baichuan, Hunyuan, SiliconFlow, Gemini, and Anthropic profiles. Users supply the provider URL, model ID, and
their own key. A key is encrypted locally with a user-provided passphrase using
PBKDF2 + AES-GCM; the passphrase is never persisted, exported, logged, or sent
to a CreatorDock server. Browser requests go directly to the supplied URL, so
provider CORS rules still apply and CreatorDock includes no proxy, quota,
account, or built-in key.

Model settings, writing style, Skill, and cover-provider settings open in
movable, resizable panels. Drag a panel header to move it and its lower-right
handle to resize it; the right-side AI writing and cover workspaces remain on
the main surface.

Writing requests use one prompt pipeline: task, style description, `.txt/.md`
samples, editable anti-AI rules, then task requirements. Samples are labeled as
stylistic references rather than instructions. Style presets can be switched or
temporarily disabled, with forbidden words and required habits editable in the
same panel. AI exports contain model metadata and a `hasApiKey` flag only;
imported profiles require the key to be entered again.

### Skill suggestions and cover generation

The separate Writing Skill panel can import a public GitHub `SKILL.md` or a local Markdown
file. Skills are stored locally and can be enabled, disabled, or deleted. They
are advisory references for structure, headlines, platform adaptation, or cover
direction only; they are never executed and never publish content. Imports are
restricted to HTTPS GitHub hosts and each skill is limited to 120,000 characters.

The “Cover generation” entry opens a separate visual workspace with 1:1, 4:5, 3:4,
16:9, 9:16, and 2:3 ratios, style presets, an optional negative prompt, and up to three local reference
images. In “Cover settings”, users provide their own HTTPS image endpoint,
model ID, and API key. Requests use an OpenAI Images-compatible body; the
“Image generation / custom” option is a compatibility entry rather than an undocumented
vendor adapter. Keys are encrypted locally and no image is published for the
user.

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
publishing, platform analytics, cloud sync, a browser extension, or Electron.
Tauri is only the desktop window, installer, shortcut, and local storage shell.
The optional AI key is user-supplied and locally encrypted; it is not a
platform credential and is never sent to a CreatorDock server. The app does not
operate platform accounts, identify accounts inside browser profiles, or bypass
platform authentication.

## License

[MIT](LICENSE)
