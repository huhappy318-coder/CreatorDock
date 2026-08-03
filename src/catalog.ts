export type VerificationStatus = 'verified' | 'unverified'

export interface PlatformPreset {
  id: string
  name: string
  url: string
  officialUrl: string
  searchTerms: string[]
  verification: VerificationStatus
  verificationNote?: string
  iconSrc: string
  brandColor: string
}

const icon = (id: string): string => `icons/platforms/${id}.png`

const preset = (
  id: string,
  name: string,
  url: string,
  brandColor: string,
  searchTerms: string[],
  verification: VerificationStatus = 'verified',
  verificationNote?: string,
): PlatformPreset => ({
  id,
  name,
  url,
  officialUrl: url,
  searchTerms,
  verification,
  ...(verificationNote ? { verificationNote } : {}),
  iconSrc: icon(id),
  brandColor,
})

export const platformPresets: readonly PlatformPreset[] = [
  preset('xiaohongshu', 'Xiaohongshu', 'https://creator.xiaohongshu.com/', '#f04444', ['小红书', 'xhs', 'rednote']),
  preset('wechat-official-accounts', 'WeChat Official Accounts', 'https://mp.weixin.qq.com/', '#19a15f', ['微信公众号', '公众号', '微信', 'wechat', 'gzh'], 'unverified', 'Official creator domain; sign-in may be required.'),
  preset('wechat-channels', 'WeChat Channels', 'https://channels.weixin.qq.com/', '#ff8c13', ['视频号', '微信视频号', 'channels', 'sph'], 'unverified', 'Official creator domain; sign-in may be required.'),
  preset('bilibili', 'Bilibili', 'https://member.bilibili.com/platform/upload/video/frame', '#f06b8d', ['哔哩哔哩', 'b站', 'bilibili']),
  preset('douyin', 'Douyin', 'https://creator.douyin.com/creator-micro/content/upload', '#161616', ['抖音', 'douyin']),
  preset('kuaishou', 'Kuaishou', 'https://cp.kuaishou.com/article/publish/video', '#f26b16', ['快手', 'kuaishou', 'ks']),
  preset('weibo', 'Weibo', 'https://weibo.com/u/page/creator/home', '#df2d2d', ['微博', 'weibo', 'wb']),
  preset('zhihu', 'Zhihu', 'https://www.zhihu.com/creator', '#1f6de0', ['知乎', 'zhihu', 'zh']),
  preset('toutiao', 'Toutiao', 'https://mp.toutiao.com/profile_v4/graphic/publish', '#ee3f2e', ['今日头条', '头条', 'toutiao'], 'unverified', 'Official creator endpoint; sign-in may be required.'),
  preset('baijiahao', 'Baijiahao', 'https://baijiahao.baidu.com/builder/rc/edit', '#2e73d5', ['百家号', '百度', 'baijiahao'], 'unverified', 'Official creator endpoint; sign-in may be required.'),
  preset('juejin', 'Juejin', 'https://juejin.cn/editor/drafts/new?v=2', '#2864d7', ['掘金', 'juejin']),
  preset('csdn', 'CSDN', 'https://editor.csdn.net/md/', '#ef5b39', ['csdn', '程序员博客']),
  preset('qq-content', 'QQ Content Open Platform', 'https://om.qq.com/', '#2878ff', ['企鹅号', '腾讯内容开放平台', 'qq', 'qiehao']),
  preset('netease-media', 'NetEase Media', 'https://mp.163.com/', '#d93232', ['网易号', '网易媒体', 'netease', '163'], 'unverified', 'Official creator domain; sign-in may be required.'),
  preset('sohu-media', 'Sohu Media', 'https://mp.sohu.com/', '#e54545', ['搜狐号', '搜狐媒体', 'sohu']),
  preset('yidian', 'Yidian', 'https://mp.yidianzixun.com/', '#3478f6', ['一点号', '一点资讯', 'yidian']),
  preset('dayu', 'Dayu', 'https://mp.dayu.com/', '#3a80ef', ['大鱼号', 'uc', 'dayu']),
  preset('xigua', 'Xigua Video', 'https://studio.ixigua.com/', '#ff4d37', ['西瓜视频', '西瓜创作平台', 'xigua']),
  preset('jianshu', 'Jianshu', 'https://www.jianshu.com/writer', '#ea6f5a', ['简书', 'jianshu']),
  preset('acfun', 'AcFun', 'https://member.acfun.cn/', '#fd4c5b', ['acfun', 'a站', 'ac娘'], 'unverified', 'Official member center; publishing availability depends on the account.'),
  preset('x-twitter', 'X/Twitter', 'https://x.com/compose/post', '#161616', ['x', 'twitter', '推特', '发帖']),
  preset('youtube', 'YouTube Studio', 'https://studio.youtube.com/', '#ff0033', ['youtube', '油管', 'yt']),
  preset('tiktok', 'TikTok Studio', 'https://www.tiktok.com/tiktokstudio/upload', '#151515', ['tiktok', '海外抖音', 'tt']),
  preset('instagram', 'Instagram', 'https://www.instagram.com/', '#c13584', ['instagram', 'ins', 'ig']),
  preset('facebook-meta', 'Facebook / Meta', 'https://business.facebook.com/latest/composer', '#1877f2', ['facebook', 'meta', '脸书', 'fb'], 'unverified', 'Official composer; availability depends on the signed-in Meta account.'),
  preset('linkedin', 'LinkedIn', 'https://www.linkedin.com/feed/?shareActive=true', '#0a66c2', ['linkedin', '领英']),
  preset('medium', 'Medium', 'https://medium.com/new-story', '#1a8917', ['medium', '文章']),
  preset('substack', 'Substack', 'https://substack.com/home', '#ff6719', ['substack', 'newsletter', '邮件通讯']),
  preset('wordpress', 'WordPress.com', 'https://wordpress.com/post', '#21759b', ['wordpress', 'wp', '博客']),
  preset('reddit', 'Reddit', 'https://www.reddit.com/submit', '#ff4500', ['reddit', '红迪']),
  preset('pinterest', 'Pinterest', 'https://www.pinterest.com/pin-creation-tool/', '#bd081c', ['pinterest', 'pin']),
  preset('twitch', 'Twitch', 'https://dashboard.twitch.tv/', '#9146ff', ['twitch', '直播']),
  preset('threads', 'Threads', 'https://www.threads.net/', '#161616', ['threads', '串文']),
  preset('bluesky', 'Bluesky', 'https://bsky.app/', '#1684ff', ['bluesky', '蓝天', 'bsky']),
]

export const customIconSrc = icon('custom')
export const aiWritingIconSrc = icon('ai-writing')
