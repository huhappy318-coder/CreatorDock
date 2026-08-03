# CreatorDock 项目提醒

> 这份文档用于下一次继续开发、发布或交接时快速恢复上下文。

## 项目定位

CreatorDock 是一个中文优先的创作者入口工作台：把小红书、微信公众号、视频号、哔哩哔哩、抖音、X/Twitter 等入口集中到一个小窗口中，并提供 AI 写作与封面生成功能。

项目只负责入口管理和本地创作辅助，不负责登录、读取账号状态、保存 Cookie/密码、自动发布或平台数据统计。

## 已确认的界面基准

- 左侧约 2/3：入口工作台、搜索、添加入口、账号卡片。
- 右侧约 1/3：AI 写作和封面生成工作区。
- 中文为默认语言，可切换英文。
- 暖白背景与橙色强调色保持不变。
- UI 使用正式的 6–8px 圆角、细边框和阴影。
- 模型设置、写作风格、Skill、封面设置均以独立浮窗打开。
- 浮窗标题栏可以拖动，右下角可以调整大小；主页面保留 AI 写作和封面工作区。

## 重要目录

| 路径 | 用途 |
| --- | --- |
| `src/main.tsx` | 主页面、入口工作台和页面状态 |
| `src/aiWorkbench.tsx` | AI 写作区、模型设置、风格与 Skill 浮窗 |
| `src/coverWorkbench.tsx` | 封面生成工作区和封面接口设置 |
| `src/floatingPanel.tsx` | 可拖动、可缩放的通用浮窗 |
| `src/styles.css` | 全局视觉样式和响应式布局 |
| `src/catalog.ts` | 平台预设、创作页入口和图标映射 |
| `src/config.ts` | schema v2 配置、导入导出和迁移 |
| `src-tauri/` | Windows/macOS 桌面壳与安装配置 |
| `public/icons/` | 平台图标和 PWA 图标 |
| `.github/workflows/` | GitHub Pages 与桌面发布工作流 |

## 本地开发

```powershell
npm ci
npm run dev
```

## 发布前验证

```powershell
npm test
npm run typecheck
npm run build
npm run check:dist
npm run test:e2e
npm run test:icons
```

Windows 桌面包：

```powershell
npm run tauri:build
```

当前已验证过的 Windows 安装包位于：

`src-tauri/target/release/bundle/nsis/CreatorDock_0.1.0_x64-setup.exe`

## 配置与安全边界

- 入口 URL 只允许 `http` 和 `https`。
- 配置保存在浏览器本地或 Tauri 应用数据目录。
- JSON 导出不包含 API Key、密码、Cookie 或令牌。
- API Key 只在本机加密存储或当前进程内使用，不能写入公开仓库。
- 平台入口只打开官方创作页、上传页或官方后台，不代替用户登录。
- Chrome/Edge Profile 仅用于兼容 Windows 快捷方式导出，不读取浏览器账号。

## 模型维护提醒

模型下拉框保留“自定义模型”能力。内置模型只是参考目录；需要获取服务商当天可用的模型时，在模型设置中填写自己的 Base URL 和 API Key，再使用“从平台刷新模型”。不要把任何真实 API Key 写入源码、测试、README 或提交记录。

## GitHub 发布提醒

当前本地仓库尚未配置 `origin` 远程地址，且本机需要先确认 GitHub CLI 或其他已授权推送方式。发布前必须：

1. 确认目标 GitHub 用户名、仓库名和可见性。
2. 配置并核对 `origin`，避免推送到错误仓库。
3. 确认本次提交包含当前项目全部相关文件，不把密钥、缓存、`node_modules`、`dist` 或 `src-tauri/target` 推上去。
4. 运行上面的测试和构建命令。
5. 创建版本标签后再触发桌面安装包 Release；v1 为未签名包，Windows SmartScreen/macOS Gatekeeper 可能提示风险。
6. 在 GitHub Pages 中将 Pages Source 设置为 GitHub Actions。

## 后续开发不要改变

- 不要把左侧工作台改回复杂的分类侧栏或多页面导航。
- 不要把写作风格、Skill、封面参数重新堆回模型设置弹窗。
- 不要预置用户的账号、密码、Cookie 或 API Key。
- 不要为了“自动登录”读取浏览器配置文件。
- 修改平台深链时，先验证官方入口；无法确认时标记为待确认，不猜测私有接口。
