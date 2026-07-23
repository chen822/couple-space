import type { Candidate, Message } from './types'

const STOP = new Set(['我们','你们','他们','这个','那个','就是','然后','因为','所以','但是','还是','已经','没有','可以','一个','什么','怎么','真的','现在','今天','明天','昨天','时候','知道','觉得','一下','这样','那样','不是','不要','我要','你要','我也','你也','好的','好吧','嗯嗯','哈哈','哈哈哈','哈哈哈哈','表情','图片','语音','视频','链接','消息'])
const NICK = /^(宝|宝宝|宝贝|乖乖|亲爱|老婆|老公|笨蛋|傻瓜|猪猪|崽崽|小可爱|大可爱|臭宝)/

const clean = (s: string) => s.replace(/\[(图片|表情|语音|视频|链接)\]/g, ' ').replace(/https?:\/\/\S+/g, ' ').replace(/\s+/g, ' ').trim()

export function parseChat(raw: unknown): Message[] {
  const root = raw as any
  const rows: any[] = Array.isArray(root) ? root : root?.messages ?? root?.data ?? root?.chatRecords ?? root?.records ?? []
  if (!Array.isArray(rows)) throw new Error('没有找到消息数组。支持顶层数组，或 messages / data / chatRecords / records 字段。')
  return rows.map((row): Message | null => {
    const content = row.content ?? row.text ?? row.message ?? row.msg ?? row.StrContent
    if (typeof content !== 'string' || !clean(content)) return null
    const sender = row.sender ?? row.from ?? row.name ?? row.nickname ?? row.talker ?? row.senderName ?? (row.isSelf ? '我' : '对方')
    const time = row.time ?? row.timestamp ?? row.createTime ?? row.CreateTime
    return { sender: String(sender || '未知'), content: clean(content), time: time == null ? undefined : String(time) }
  }).filter((x): x is Message => Boolean(x))
}

function chunks(text: string): string[] {
  const parts = text.split(/[，。！？!?、；;：:\s~～…（）()【】\[\]“”"']/).filter(Boolean)
  const out: string[] = []
  for (const part of parts) {
    if (/^[\u4e00-\u9fff]{2,12}$/.test(part)) {
      if (part.length <= 7) out.push(part)
      for (let n = 2; n <= Math.min(5, part.length); n++) for (let i = 0; i <= part.length - n; i++) out.push(part.slice(i, i + n))
    }
  }
  return out
}

export function analyze(messages: Message[]): Candidate[] {
  const stats = new Map<string, { count: number; users: Record<string, number>; ids: number[] }>()
  messages.forEach((m, id) => {
    const seen = new Set<string>()
    chunks(m.content).forEach(phrase => {
      if (STOP.has(phrase) || /^(哈哈|呵呵|嘿嘿)+$/.test(phrase) || /^(我|你|他|她|的|了|啊|呀|嘛|吧|呢|哦|嗯)+$/.test(phrase)) return
      const s = stats.get(phrase) ?? { count: 0, users: {}, ids: [] }
      s.count++; s.users[m.sender] = (s.users[m.sender] ?? 0) + 1
      if (!seen.has(phrase)) s.ids.push(id)
      seen.add(phrase); stats.set(phrase, s)
    })
  })
  const phrases = [...stats.entries()].filter(([p,s]) => s.count >= 2 && (p.length >= 2 || NICK.test(p)))
  return phrases.map(([phrase, s]): Candidate => {
    const topUser = Object.entries(s.users).sort((a,b) => b[1]-a[1])[0]?.[0] ?? '未知'
    const neighbors = new Map<string, number>()
    s.ids.forEach(id => {
      for (let j = Math.max(0,id-1); j <= Math.min(messages.length-1,id+1); j++) {
        chunks(messages[j].content).filter(x => x !== phrase && x.length >= 2 && !STOP.has(x)).forEach(x => neighbors.set(x,(neighbors.get(x)??0)+1))
      }
    })
    const ratio = Math.max(...Object.values(s.users)) / s.count
    const category: Candidate['category'] = NICK.test(phrase) ? '昵称' : ratio > .78 ? '口头禅' : phrase.length >= 4 ? '固定短语' : '共同记忆'
    return { phrase, count:s.count, users:s.users, topUser, contexts:s.ids.slice(0,3).map(i=>messages[i]), collocations:[...neighbors].sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>x[0]), score:s.count*(1+phrase.length*.12)*(ratio>.7?1.2:1), category }
  }).sort((a,b)=>b.score-a.score).filter((c,_,all)=>!all.some(x=>x!==c && x.phrase.includes(c.phrase) && x.count===c.count && x.phrase.length>c.phrase.length)).slice(0,80)
}
