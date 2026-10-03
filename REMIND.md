# CreatorDock 快速开始

CreatorDock 用于管理多平台分发：准备内容、打开各平台后台、逐个平台记录发布进度。AI 是可选辅助，首次使用无需配置模型。

![分发工作台](docs/images/guide-progress.jpg)

## 完整图文说明

**[打开《CreatorDock 中文图文使用说明》](docs/USER_GUIDE.zh-CN.md)**：包含新建分发、平台独立文案、发布记录、平台管理、内容归档、备份迁移、AI 辅助和手机布局截图。

## 打开应用

1. 在 [GitHub Releases](https://github.com/huhappy318-coder/CreatorDock/releases) 下载 `CreatorDock-ready-20261003.zip` 并完整解压。
2. 安装 Python 3.9+。macOS 双击 `启动CreatorDock.command`，或在解压目录运行 `python3 scripts/serve-built.py`。
3. 打开 `http://127.0.0.1:5187/CreatorDock/`，保持启动终端运行。

这个 ZIP 是含源码和网页构建产物的本地运行包，不是原生桌面安装器。GitHub 自动生成的 Source code ZIP 不含网页构建产物；源码安装方法见完整说明。

## 完成第一次分发

1. 点击“新建分发”，填写标题、正文，选择目标平台并保存。
2. 在当前分发中选择平台，复制标题、正文，打开发布后台。
3. 在平台完成发布后，回到 CreatorDock，填写可选的文章链接并“标记已发布”。
4. 逐个平台重复，全部完成后内容自动进入“已完成”。
5. 定期在“设置”中分别导出分发备份和配置。

平台登录和实际发布需要你自己完成；数据保存在当前浏览器，不会自动云同步。

[项目说明与开发方式](README.md) · [中文图文手册](docs/USER_GUIDE.zh-CN.md)
