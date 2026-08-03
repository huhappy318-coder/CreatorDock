# Errors

## ai-workbench-skill-file-selector-conflict-2026-08-01

- `status: verified`
- `observed_at: 2026-08-01`
- `scope: AI workbench component test`
- 触发场景：加入 Skill 文件上传后，原 AI 工作台测试的 `input[accept*=".txt"]` 选择到了 Skill 上传控件，导致样本文件读取断言超时。
- 实际观察：Skill 上传控件的 `.txt` 接受范围与已有写作样本控件重叠，测试状态显示 `file.text is not a function` 或找不到 `voice.md`。
- 根因：多个文件输入控件共享模糊的 `accept` 查询，首个 DOM 匹配随布局变化。
- 恢复方式：Skill 上传限制为 Markdown 类型，并在工作台测试增加 cleanup；之后该测试与全套 71 个单元测试均通过。
- 防复发：新增文件输入控件时避免无必要的扩展名重叠，组件测试优先使用语义标签或专用属性定位。
- `promotion_candidate: false`
- `promoted_to: pending`
- `last_reviewed: 2026-08-01`

## creator-dock-tauri-toolchain-2026-08-01

- `status: pending`
- `observed_at: 2026-08-01`
- `scope: desktop release build`
- 触发场景：在 Windows 本机执行 `npm run tauri -- build --debug --bundles nsis`。
- 实际观察：Tauri 在 `cargo metadata --no-deps --format-version 1` 处失败，报告 `program not found`；`npm run tauri:info` 同时显示未检测到 rustc/Cargo 与 Visual Studio MSVC/SDK。
- 证据：命令输出已保留在本次交付记录；WebView2 可用，前端构建与测试不受影响。
- 可复用规则：先运行 `npm run tauri:info` 检查 Rust 与 MSVC，再判断本机能否生成安装包；缺少工具链时交由 GitHub Actions 的 Windows/macOS runner 构建。
- `promotion_candidate: true`
- `promoted_to: pending`
- `last_reviewed: 2026-08-01`

## tauri-info-timeout-2026-08-01

- `status: pending`
- `observed_at: 2026-08-01`
- `scope: environment diagnostics`
- 触发场景：用 30 秒超时运行 `npm run tauri:info`。
- 实际观察：命令完成时间超过 30 秒，超时终止导致子进程向已关闭 stdout 写入并出现管道错误；用 90 秒超时重跑后正常输出环境诊断。
- 可复用规则：Tauri 环境诊断使用至少 90 秒超时，不把被截断的 stdout 当成编译失败。
- `promotion_candidate: false`
- `promoted_to: pending`
- `last_reviewed: 2026-08-01`

## tauri-pathresolver-api-2026-08-01

- `status: pending`
- `observed_at: 2026-08-01`
- `scope: Tauri Windows compilation`
- 触发场景：第一次启用 Rust/MSVC 后构建桌面应用。
- 实际观察：Rust 编译报告 `PathResolver` 没有 `app_exe()`，错误位于非 macOS 别名目标函数；同时暴露 Windows 编译中的未使用 macOS 辅助函数警告。
- 根因：把旧/假设的 Tauri Path API 放在了所有目标都会编译的分支中。
- 恢复方式：移除非 macOS 的 `app_exe()` 实现，只在 macOS `cfg` 块内编译别名目标和可用路径函数；随后 release NSIS 构建通过。
- 可复用规则：跨平台 Tauri Rust 函数必须让每个目标的 API 调用都包在对应 `cfg` 编译块内。
- `promotion_candidate: true`
- `promoted_to: pending`
- `last_reviewed: 2026-08-01`

## dist-check-race-repeat-2026-08-01

- `status: pending`
- `observed_at: 2026-08-01`
- `scope: build verification`
- 触发场景：把 `npm run build` 与 `npm run check:dist` 放在同一个并行批次。
- 实际观察：检查读到了另一轮构建的 `dist`，出现 precache 数量与 JavaScript 文件名不一致；串行重跑后两者均为 31 项且文件名一致。
- 根因：两个命令共享并覆盖同一个输出目录。
- 恢复方式：先完成 build，再运行 check；涉及 `dist` 的 E2E 也必须串行。
- 可复用规则：禁止并行执行任何会写入或读取 `dist` 的命令。
- `promotion_candidate: true`
- `promoted_to: pending`
- `last_reviewed: 2026-08-01`

## default-wechat-e2e-count-2026-08-01

- `status: pending`
- `observed_at: 2026-08-01`
- `scope: default configuration E2E`
- 触发场景：为默认配置增加两个公众号入口后，E2E 仍按旧数量断言。
- 实际观察：`npm run test:e2e` 的页面行为 4/5 用例通过，重复平台断言收到 5 个入口而预期为 4。
- 根因：原有一个公众号预设、两个新增入口，加上新加入的两个默认账号，旧断言没有同步需求变更。
- 恢复方式：将断言更新为 5，并重新运行完整 E2E。
- 可复用规则：默认入口数量变化时，同时检索单元测试、E2E 和导出数量断言。
- `promotion_candidate: false`
- `promoted_to: pending`
- `last_reviewed: 2026-08-01`

## nsis-duplicate-shortcut-2026-08-01

- `status: verified`
- `observed_at: 2026-08-01`
- `scope: Windows NSIS desktop shortcut lifecycle`
- 触发场景：第一次用安装器自定义 hook 创建桌面入口并运行临时目录自检。
- 实际观察：默认 Tauri NSIS 模板已经创建 `CreatorDock.lnk`，hook 又创建了 `CreatorDock (2).lnk`；严格自检发现两个链接都指向同一个临时 `creator_dock.exe`。
- 根因：hook 没有意识到默认安装模板在 `NSIS_HOOK_POSTINSTALL` 之前已创建主快捷方式。
- 恢复方式：post-install 先记录已经存在的主链接，只有主链接不存在时才创建后缀链接；pre-install 在同名链接属于其他安装位置或其他程序时先移至后缀名，避免覆盖。
- 验证：重建 release NSIS 后，临时安装/卸载自检通过；正式安装只保留一个 `C:\Users\huawei\Desktop\CreatorDock.lnk`，目标为用户安装目录中的 `creator_dock.exe`。
- `promotion_candidate: true`
- `promoted_to: pending`
- `last_reviewed: 2026-08-01`

## macos-target-local-check-2026-08-01

- `status: pending`
- `observed_at: 2026-08-01`
- `scope: local macOS cross-target verification on Windows`
- 触发场景：尝试在 Windows 本机通过 Rust Apple targets 做 `cargo check`，以补充 GitHub macOS runner 之外的证据。
- 实际观察：当前稳定 Rust sysroot 没有 `x86_64-apple-darwin` 或 `aarch64-apple-darwin` 标准库；官方 rustup-init 在恢复 toolchain 时持续运行超过 120 秒，未安装 targets，随后被停止。
- 边界：这不改变 macOS CI workflow；本机仍不能声称生成过 `.app/.dmg`。
- 可复用规则：Windows 本机只报告已安装的 MSVC/Rust 目标；macOS bundle 的最终证据必须来自 macOS runner 或真实 Mac。
- `promotion_candidate: false`
- `promoted_to: pending`
- `last_reviewed: 2026-08-01`

## tauri-bundle-refresh-rustc-missing-2026-08-01

- `status: pending`
- `observed_at: 2026-08-01`
- `scope: Windows desktop release refresh`
- Trigger: after changing the default HTML language, attempted to re-run the local NSIS bundle with the current web `dist`.
- Observation: the configured rustup toolchain reports `rustc-x86_64-pc-windows-msvc` as installed, but the toolchain directory contains no `rustc.exe`; `rustc --version` reports that the binary is not applicable, and Tauri bundle panics while resolving Rust metadata.
- Evidence: `rustup show`, `rustup component list --installed`, `where rustc`, and `npm run tauri bundle -- --bundles nsis --no-sign --ci` output from this run.
- A forced `rustup toolchain install ... --profile minimal --force-non-host` retry exceeded 180 seconds and was stopped. Removing and re-adding the component also exceeded 180 seconds; `rustc --version` now explicitly reports the component is not installed.
- Reusable rule: do not claim a freshly refreshed local desktop installer until `rustc --version` and the Tauri bundle both pass; use the existing verified installer or a CI Windows runner while repairing the local Rust component.
- `promotion_candidate: false`
- `promoted_to: pending`
- `last_reviewed: 2026-08-01`

## compact-layout-e2e-settings-2026-08-01

- `status: verified`
- `observed_at: 2026-08-01`
- `scope: compact two-column workbench E2E`
- Trigger: moved backup controls into a collapsed Preferences details panel while simplifying the desktop layout.
- Observation: the first E2E run timed out waiting for export downloads because the test clicked hidden controls; its WeChat count also used the old default quantity.
- Root cause: the test encoded the previous sidebar layout and previous default catalog size.
- Recovery: added an explicit Preferences expansion helper, updated the expected default catalog to five common platforms plus two WeChat account entries, and reran all five E2E tests successfully.
- Reusable rule: when controls move into a disclosure panel, E2E must open the panel before interacting; default catalog changes require updating export and duplicate-platform counts together.
- `promotion_candidate: false`
- `promoted_to: pending`
- `last_reviewed: 2026-08-01`
