# CreatorDock 使用说明

![CreatorDock 主界面](docs/images/creatordock-overview.png)

## 快速安装

1. 打开 [GitHub Releases](https://github.com/huhappy318-coder/CreatorDock/releases)，确认页面已有适合你系统的安装附件。
2. Windows 下载 `CreatorDock_*_x64-setup.exe` 并双击安装；macOS 下载 `.dmg`，将应用拖入“应用程序”。
3. 从桌面或“应用程序”启动 CreatorDock。首次使用请在“模型设置”中设置本机解锁口令、选择模型并填入自己的 API Key。

> Releases 页面尚无附件时，说明公开安装包还未发布；请不要下载来源不明的同名文件，可先按本文末尾的源码方式运行。

CreatorDock 是一个中文优先的创作者工作台：左侧管理常用平台入口，右侧进行 AI 写作和封面生成。

## 项目简介

### 中文

CreatorDock 是一个静态、可安装的创作者工作台，适合同时管理多个发布平台和多个账号入口。它保存账号名称、网址、排序和可选的 Windows 浏览器快捷方式设置，但不保存账号本身。

### English

CreatorDock is a local-first, installable launchpad for creators who manage multiple publishing destinations. It keeps account labels, URLs, ordering, and optional Windows browser-profile shortcut settings locally; it does not hold the accounts themselves.

完整项目说明请查看 [README.md](README.md)。

## 安装

如果 GitHub 仓库的 **Releases** 还没有文件，表示安装包尚未发布；可以先按本文最后的源码方式运行，或等待维护者上传安装包。

### Windows

1. 打开 GitHub 仓库的 **Releases** 页面。
2. 下载 `CreatorDock_*_x64-setup.exe`。
3. 双击安装，安装完成后桌面会自动出现 `CreatorDock.lnk`。
4. 第一次运行如果出现 SmartScreen 提示，点击“更多信息”→“仍要运行”。当前版本未做代码签名，这是正常提示。

### macOS

1. 在 **Releases** 下载 `.dmg` 文件。
2. 打开后把 CreatorDock 拖到“应用程序”。
3. 从“应用程序”启动；首次打开可按提示创建桌面别名。如系统提示未验证开发者，请在系统设置中确认打开。

## 基本使用

1. 打开 CreatorDock，首页会显示 7 个常用入口，包括两个公众号账号入口。
2. 点击任意卡片即可在系统浏览器打开对应的官方创作页或平台入口。
3. 使用顶部搜索框查找入口；点击“添加入口”可以增加平台或自定义网址。
4. 卡片底部可以上移、下移、编辑或删除入口。
5. 右侧“AI 写作”中输入写作任务，点击“生成内容”。模型设置里需要设置本机解锁口令、选择模型并填入你自己的 API Key。
6. 点击“写作风格与去 AI 味”“写作 Skill”或“封面生成”使用对应功能。设置窗口可以拖动标题栏，右下角可以调整大小。
7. 封面工作区支持比例、风格、参考素材和负面提示词；点击“回到写作”返回 AI 写作区。

## 注意事项

- CreatorDock 不代替用户登录，不读取密码、Cookie 或账号状态。
- 配置保存在本机；导出的 JSON 不包含 API Key。
- 平台入口只接受 `http` 或 `https` 地址。
- AI 写作和生图使用你自己的模型接口，不提供内置额度，也不会自动发布内容。

## 从源码运行（开发者）

```powershell
npm ci
npm run dev
```

桌面安装包构建：

```powershell
npm run tauri:build
```

当前项目地址：[huhappy318-coder/CreatorDock](https://github.com/huhappy318-coder/CreatorDock)
