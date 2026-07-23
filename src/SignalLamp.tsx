import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Check, Copy, Heart, LockKeyhole, Sparkles } from 'lucide-react'
import './signal.css'

type Signal = { id:string; title:string; subtitle:string; emoji:string; color:string; message:string }
const signals: Signal[] = [
  { id:'hug', title:'想抱抱', subtitle:'今天需要一点靠近', emoji:'🤍', color:'#e98794', message:'今天有点想抱抱你。' },
  { id:'talk', title:'想聊天', subtitle:'有些小事想和你说', emoji:'💬', color:'#7c98d0', message:'今天想和你聊聊天，听听你的声音。' },
  { id:'quiet', title:'需要安静', subtitle:'不是不理你，只是充会儿电', emoji:'🌙', color:'#8a819f', message:'我今天需要安静充充电，但还是很爱你。' },
  { id:'happy', title:'今天开心', subtitle:'想把好心情分你一半', emoji:'☀️', color:'#e5a84a', message:'今天心情很好，想把这份开心分给你。' },
  { id:'miss', title:'想念你', subtitle:'在普通的一天想起你', emoji:'🫶', color:'#c96778', message:'今天很想你。' }
]
type Saved = { id:string; note:string; at:string }

export function SignalLamp({ onBack }: { onBack: () => void }) {
  const [selected, setSelected] = useState('hug')
  const [note, setNote] = useState('')
  const [saved, setSaved] = useState<Saved | null>(null)
  const [copied, setCopied] = useState(false)
  const signal = useMemo(() => signals.find(x => x.id === selected)!, [selected])
  useEffect(() => { const raw = localStorage.getItem('couple-signal'); if (raw) try { setSaved(JSON.parse(raw)) } catch { /* ignore malformed local state */ } }, [])
  const save = () => { const next = { id: selected, note: note.trim(), at: new Date().toISOString() }; localStorage.setItem('couple-signal', JSON.stringify(next)); setSaved(next); setCopied(false) }
  const copy = async () => { const text = `恋爱信号灯 · ${signal.emoji} ${signal.title}\n${note.trim() || signal.message}\n—— 来自你的小朋友`; await navigator.clipboard.writeText(text); setCopied(true) }
  return <main className="signalPage"><nav><button className="back" onClick={onBack}><ArrowLeft size={18} /> 返回词典</button><div className="brand"><Heart fill="#ca5a62" /> 恋爱信号灯</div><span className="privacy"><LockKeyhole size={15} /> 仅保存在此设备</span></nav><section className="signalShell"><div className="signalIntro"><div className="eyebrow"><Sparkles size={14} /> A SMALL WAY TO SAY IT</div><h1>不必想很久，<br />也能让对方知道你的心情。</h1><p>选一个信号，写一句可选的话；保存后可一键复制到微信。</p></div><div className="signalLayout"><div className="signalChoices">{signals.map(item => <button key={item.id} className={selected === item.id ? 'signalChoice active' : 'signalChoice'} onClick={() => { setSelected(item.id); setCopied(false) }}><span style={{ background:item.color }}>{item.emoji}</span><b>{item.title}</b><small>{item.subtitle}</small></button>)}</div><div className="signalCard" style={{ '--signal': signal.color } as React.CSSProperties}><div className="lampGlow">{signal.emoji}</div><div className="cardLabel">TODAY'S SIGNAL</div><h2>{signal.title}</h2><p>{note.trim() || signal.message}</p><textarea value={note} onChange={e => setNote(e.target.value)} maxLength={80} placeholder="想再留一句话给对方吗？（选填）" /><div className="signalActions"><button className="saveSignal" onClick={save}><Check size={17} /> 保存今天的信号</button><button className="copySignal" onClick={copy}><Copy size={16} /> {copied ? '已复制，去微信发送吧' : '复制给对方'}</button></div></div></div>{saved && <p className="savedHint">今天已保存：{signals.find(x => x.id === saved.id)?.emoji} {signals.find(x => x.id === saved.id)?.title}{saved.note ? ` · ${saved.note}` : ''}</p>}</section></main>
}
