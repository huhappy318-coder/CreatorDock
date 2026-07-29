export type VerificationStatus = 'verified' | 'unverified'

export interface PlatformPreset {
  id: string
  name: string
  url: string
  category: 'social' | 'video' | 'writing' | 'developer'
  verification: VerificationStatus
  verificationNote?: string
}

export const platformPresets: readonly PlatformPreset[] = [
  { id: 'xiaohongshu', name: 'Xiaohongshu', url: 'https://creator.xiaohongshu.com/', category: 'social', verification: 'verified' },
  { id: 'wechat-official-accounts', name: 'WeChat Official Accounts', url: 'https://mp.weixin.qq.com/', category: 'social', verification: 'unverified', verificationNote: 'Official domain, but the public endpoint could not be fetched during verification.' },
  { id: 'wechat-channels', name: 'WeChat Channels', url: 'https://channels.weixin.qq.com/', category: 'video', verification: 'unverified', verificationNote: 'Official domain, but the public endpoint could not be fetched during verification.' },
  { id: 'bilibili', name: 'Bilibili', url: 'https://member.bilibili.com/platform/home', category: 'video', verification: 'verified' },
  { id: 'douyin', name: 'Douyin', url: 'https://creator.douyin.com/', category: 'video', verification: 'verified' },
  { id: 'x-twitter', name: 'X/Twitter', url: 'https://x.com/', category: 'social', verification: 'verified' },
  { id: 'kuaishou', name: 'Kuaishou', url: 'https://cp.kuaishou.com/', category: 'video', verification: 'verified' },
  { id: 'weibo', name: 'Weibo', url: 'https://weibo.com/', category: 'social', verification: 'verified' },
  { id: 'zhihu', name: 'Zhihu', url: 'https://www.zhihu.com/', category: 'writing', verification: 'verified' },
  { id: 'toutiao', name: 'Toutiao', url: 'https://mp.toutiao.com/', category: 'writing', verification: 'unverified', verificationNote: 'The creator endpoint timed out during verification.' },
  { id: 'baijiahao', name: 'Baijiahao', url: 'https://baijiahao.baidu.com/', category: 'writing', verification: 'unverified', verificationNote: 'The public endpoint could not be fetched during verification.' },
  { id: 'juejin', name: 'Juejin', url: 'https://juejin.cn/', category: 'developer', verification: 'verified' },
  { id: 'csdn', name: 'CSDN', url: 'https://www.csdn.net/', category: 'developer', verification: 'verified' },
]
