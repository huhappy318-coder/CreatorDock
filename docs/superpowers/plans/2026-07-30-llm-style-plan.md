# CreatorDock 多 LLM / 写作风格实施计划

## Task 1：基础契约与加密配置

- 新增版本化 AI 配置 schema、模型 CRUD、风格 CRUD、默认项和本机 storage namespace。
- 使用 WebCrypto PBKDF2 + AES-GCM；Key 仅在解锁后的内存对象中可用。
- 测试假密钥、错误口令、刷新锁定、导出脱敏、旧/坏配置恢复。

## Task 2：统一客户端

- 实现 OpenAI-compatible、DashScope、Gemini、Anthropic 请求适配器。
- 统一 `testConnection`、非流式生成、SSE/ReadableStream 流式生成和错误归一化。
- 所有生成调用经过 `buildSystemPrompt`，连接测试不泄露风格样本。
- 测试请求 JSON、headers、URL、流式片段、取消和 CORS/HTTP 错误。

## Task 3：风格和去 AI 味

- 内置默认规则，支持用户覆盖、禁止词、必须习惯和多个样本。
- 新增样本粘贴/`.txt`/`.md` 读取、大小校验、删除、预览和默认风格切换。
- 测试 prompt 顺序、分隔符、临时关闭、大小限制和数据隔离。

## Task 4：界面接入

- 在现有 CreatorDock 导航中加入模型管理、写作风格和 AI 写作视图/面板。
- 所有文本生成入口只调用统一客户端；显示当前模型、风格和去 AI 味状态。
- 补齐加载、流式、取消、错误、未解锁、无模型和无 CORS 状态。

## Task 5：安全与交付验证

- README 说明用户自行承担 Key、费用、CORS 和厂商条款；明确不代理请求。
- 运行 `npm test`、`npm run typecheck`、`npm run build` 和不含秘密的静态扫描。
- 用假 Key/本地 fetch stub 验证完整流程；真实 Key 只留给用户手动验证，不写入仓库。

