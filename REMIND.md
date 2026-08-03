# CreatorDock 使用说明

![CreatorDock 主界面](docs/images/creatordock-overview.png)

CreatorDock 是一个中文优先的创作者工作台：左侧管理常用平台入口，右侧进行 AI 写作和封面生成。

## 安装

### Windows

1. 打开 GitHub 仓库的 **Releases** 页面。
2. 下载 `CreatorDock_*_x64-setup.exe`。
3. 双击安装，安装完成后桌面会自动出现 `CreatorDock.lnk`。
4. 第一次运行如果出现 SmartScreen 提示，点击“更多信息”→“仍要运行”。当前版本未做代码签名，这是正常提示。

### macOS

1. 在 **Releases** 下载 `.dmg` 文件。
2. 打开后把 CreatorDock 拖到“应用程序”。
3. 从“应用程序”启动；如系统提示未验证开发者，请在系统设置中确认打开。

## 基本使用

1. 打开 CreatorDock，首页会显示 7 个常用入口，包括两个公众号账号入口。
2. 点击任意卡片即可在系统浏览器打开对应的官方创作页或平台入口。
3. 使用顶部搜索框查找入口；点击“添加入口”可以增加平台或自定义网址。
4. 卡片底部可以上移、下移、编辑或删除入口。
5. 右侧“AI 写作”中输入写作任务，点击“生成内容”。模型设置里只需要填写你自己的模型和 API Key。
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
