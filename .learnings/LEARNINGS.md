# Learnings

## creator-dock-china-model-skill-cover-2026-08-01

- `status: verified`
- `observed_at: 2026-08-01`
- `scope: CreatorDock AI writing and cover workspaces`
- 触发场景：用户要求补充中国模型 API、从 GitHub 或本地导入 Skill，并增加自有图片 API 的封面生成与参考素材能力。
- 实际观察：供应商选择器新增 DeepSeek、通义千问、智谱 GLM、Kimi、MiniMax、豆包/火山方舟、百川、腾讯混元、硅基流动等 HTTPS 默认地址；Skill 仅作为提示参考保存在本机；封面工作区支持比例、风格、最多三张参考图和加密保存的用户 API Key。
- 验证证据：`npm test` 通过 14 个文件/71 个用例；`npm run test:e2e` 通过 7 个用例；生产构建与 `npm run check:dist` 通过；16 个图标和 24 项快捷方式断言通过；预览截图已检查主界面、封面工作区和封面设置弹窗。
- 关键边界：Skill 不执行、不自动发布；图片接口按 OpenAI Images 兼容请求发送；“圣图/自定义”不猜测未提供文档的私有协议；API Key 只在本机口令下加密保存。
- 可复用规则：当设置面板新增文件上传控件时，给控件区分明确的 `accept` 或测试选择器，避免与已有样本导入控件产生首个匹配冲突。
- `promotion_candidate: true`
- `promoted_to: pending`
- `last_reviewed: 2026-08-01`

## creator-dock-release-verification-2026-08-01

- `status: verified`
- `observed_at: 2026-08-01`
- `scope: CreatorDock PWA and desktop release preparation`
- 触发场景：为 React/Vite PWA 接入 Tauri 2、图标切片、NSIS/macOS 发布工作流。
- 实际观察：直接 Vitest 11 个文件/58 个用例通过；生产构建通过；图标脚本验证 16 个 512×512 RGBA 图标；GitHub Pages `/CreatorDock/` 预览的 5 个 Playwright E2E 用例通过；launcher 和 shortcut 自检分别通过 9、24 项断言。
- 关键路径：素材源图固定为 2048×2048，脚本切出 4×4 512px 图标并生成 manifest；前端图标路径使用相对路径，E2E 对 Pages 子路径下的资源返回 200；E2E 与静态检查不得并行重写同一个 `dist` 目录。
- 可复用规则：涉及同一 `dist` 输出目录的构建/检查命令必须串行运行；Windows/macOS 安装包由带 Rust/MSVC 的 CI runner 生成，本机只报告真实工具链检查结果。
- 需求补齐：默认配置现在包含两个公众号入口，分别使用 Chrome/Edge 的 `Default` profile 并进入快捷方式导出；E2E 同时验证可见卡片与导出字段。
- 安全边界：桌面外链不再直接授予前端 Shell open 权限，而是经 `open_external` Rust 命令做第二次 HTTP(S) 与凭据校验。
- `promotion_candidate: true`
- `promoted_to: pending`
- `last_reviewed: 2026-08-01`

## creator-dock-language-and-windows-build-2026-08-01

- `status: verified`
- `observed_at: 2026-08-01`
- `scope: CreatorDock interface and Windows desktop release`
- 触发场景：用户要求中文界面优先，同时支持 English 切换，并要求继续完成可安装桌面版。
- 实际观察：配置新增 `language` 字段；缺失字段的旧 JSON 自动迁移为 `zh-CN`；设置区可以在中文和 English 间切换，语言随浏览器 localStorage/Tauri Store 保存。主要工作台与 AI 写作区控件会随语言切换。
- 验证证据：`npm test` 通过 11 个文件/60 个用例；`npm run test:e2e` 通过 5 个用例；`npm run build`、`npm run check:dist`、`npm run test:icons`、launcher 9 项与 shortcut helper 24 项自检通过。release NSIS 实际构建成功，并在 `C:\Users\huawei\AppData\Local\CreatorDock` 安装后验证单一桌面快捷方式和可响应进程。
- 可复用规则：界面文案新增语言时，配置迁移、无存储默认态、入口编辑对话框、空状态、E2E 选择器和桌面版构建必须一起验证；PWA/Tauri 共享同一语言字段但不共享浏览器存储。
- `promotion_candidate: true`
- `promoted_to: pending`
- `last_reviewed: 2026-08-01`

## creator-dock-compact-chinese-first-layout-2026-08-01

- `status: pending`
- `observed_at: 2026-08-01`
- `scope: CreatorDock desktop and browser workbench UI`
- Trigger: user requested a compact small-window interface, Chinese-first copy, only a few common initial platforms, user-managed add/edit/delete, and a fixed two-column workbench with AI writing on the right.
- Observation: the initial layout used a large hero, permanent sidebar, 15 default entries, and AI writing below the workbench; the revised layout uses a 2:1 workbench/AI split, a compact header, collapsed preferences, five common platform presets plus two WeChat account entries, and an in-page AI column.
- Evidence: the 1080×720 production preview screenshot at `C:\Windows\TEMP\CreatorDock-compact-layout-v2.png`, `npm test` 61/61, and `npm run test:e2e` 5/5 after the revision.
- Reusable rule: default catalog breadth and layout density are product choices; keep the catalog extensible while leaving the first launch focused and test the rendered viewport, not only component behavior.
- `promotion_candidate: true`
- `promoted_to: pending`
- `last_reviewed: 2026-08-01`

## creator-dock-minimal-home-ai-settings-2026-08-01

- `status: pending`
- `observed_at: 2026-08-01`
- `scope: CreatorDock browser and desktop workbench UI`
- Trigger: user marked the brand subtitle, category navigation, card metadata, shortcut badges, and AI configuration panels as unnecessary on the home surface.
- Observation: the home now shows only the CreatorDock brand, entry search, icon/name cards, and a large AI writing task panel; model connection, writing style, and humanization controls open from the AI settings button.
- Evidence: `C:\Windows\TEMP\CreatorDock-simplified-layout-final.png`, `npm test` 61/61, `npm run test:e2e` 6/6, `npm run build`, and `npm run check:dist` passed.
- Reusable rule: keep the first screen task-focused; put advanced configuration behind an explicit settings action and avoid repeating platform/category metadata when the entry name is already visible.
- `promotion_candidate: true`
- `promoted_to: pending`
- `last_reviewed: 2026-08-01`
