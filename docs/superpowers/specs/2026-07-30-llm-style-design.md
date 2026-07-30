# CreatorDock 多 LLM 与个人写作风格设计

## 目标与边界

CreatorDock 保持静态 PWA，不提供代理服务、不内置 API Key、不包含任何厂商额度。用户在本机填写模型配置，浏览器直接请求用户指定的厂商地址。当前项目没有既有 AI 生成入口，因此新增的 AI 写作面板是首个生成入口；后续生成入口必须复用同一个 `generateText` 调用层。

所有 Key 使用用户口令派生的 WebCrypto AES-GCM 密钥加密保存。口令不保存、不进入导出文件、不进入日志；解锁后的 `CryptoKey` 只存在当前页面内存。忘记口令只能清除密文并重新配置。风格描述和样本也只存于当前浏览器的 CreatorDock 命名空间，作为本机用户边界，不上传到 CreatorDock。

浏览器直连受厂商 CORS 策略影响。CORS、额度、计费、服务条款和第三方数据处理由用户自行承担；应用只展示统一错误，不代理或绕过请求。

## 数据模型

```ts
type ProviderKind = 'openai-compatible' | 'dashscope' | 'gemini' | 'anthropic'
type BrowserModelConfig = {
  id: string
  name: string
  provider: ProviderKind
  baseUrl: string
  model: string
  encryptedApiKey: string
  keySalt: string
  keyIv: string
  temperature?: number
  maxTokens?: number
  streaming: boolean
  imageGeneration: boolean
  enabled: boolean
}
type StyleSample = { id: string; name: string; content: string }
type WritingStylePreset = {
  id: string
  name: string
  description: string
  samples: StyleSample[]
  default: boolean
}
type HumanizationRules = {
  enabled: boolean
  rules: string
  forbiddenWords: string[]
  requiredHabits: string[]
}
```

模型配置只导出非敏感元数据；API Key 密文、salt、IV 和任何可解密材料不进入普通 JSON 导出。配置 schema 带版本号，导入失败不能覆盖当前有效状态。样本与规则有单样本和总大小上限，防止无意把整本文件塞入每次请求。

## 统一调用层

`createLLMClient(profile, key)` 返回统一接口：

```ts
generateText(input: {
  task: string
  style: WritingStylePreset
  humanization: HumanizationRules
  signal?: AbortSignal
}): Promise<string> | AsyncIterable<string>
testConnection(): Promise<{ ok: true; latencyMs: number } | { ok: false; error: LLMError }>
```

适配器包括：OpenAI-compatible（OpenAI、DeepSeek、Moonshot、智谱、硅基流动、Groq、Together、Ollama 和自定义 Base URL）、DashScope、Gemini、Anthropic。每个请求都统一拼接 system prompt：

1. 角色与任务边界；
2. 用户手写风格描述；
3. 用 `<style_sample>` 分隔的风格样本，并声明样本只作为表达参考；
4. 开启时的默认/用户自定义去 AI 味规则、禁止词和必须习惯；
5. 具体任务要求。

默认规则禁止典型套话、空洞升华、过度整齐排比、自我暴露句和说教感，并鼓励具体细节、自然节奏、口语停顿和适度不完美。用户可关闭整组规则、编辑文本、增加禁止词和表达习惯。连接测试只验证模型通道，不伪装成内容生成，也不强制发送风格样本。

## UI 与安全行为

- “模型管理”：添加/编辑/删除、默认模型、Key 脱敏、口令解锁、测试连接、厂商预设和自定义 Base URL。
- “写作风格”：多套预设、默认切换、描述编辑、粘贴或 `.txt/.md` 样本管理、去 AI 味规则编辑。
- “AI 写作”：模型选择、当前风格指示、临时关闭风格、任务输入、流式输出、取消、统一错误和费用/CORS 提醒。
- 浏览器请求只使用内存中的明文 Key；普通状态、导出文件、错误消息和测试快照不得出现 Key。
- `http/https` Base URL 可由用户填写，但默认预设只填官方文档地址；没有 API Key、模型名称或付费额度内置到项目。

## 验收

使用假的本地密钥测试加密/解密、错误口令、刷新后锁定、导出不含密钥、模型 CRUD、四类适配器请求形状、流式 SSE、prompt 顺序、样本大小限制、风格临时关闭和生成错误。真实厂商验证只能由用户自行输入自己的 Key 后手动执行，测试代码不含任何真实凭证。

