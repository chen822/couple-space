import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { ArrowLeft, Check, Copy, Heart, Link, LockKeyhole, LogOut, KeyRound, Sparkles, Users } from 'lucide-react'
import { supabase } from './supabase'
import './signal.css'
import './signal-sync.css'

type Signal = { id:string; title:string; subtitle:string; emoji:string; color:string; message:string }
type RemoteSignal = { id:string; room_id:string; sender_id:string; kind:string; note:string; created_at:string }
const signals: Signal[] = [
  { id:'hug', title:'想抱抱', subtitle:'今天需要一点靠近', emoji:'🤍', color:'#e98794', message:'今天有点想抱抱你。' },
  { id:'talk', title:'想聊天', subtitle:'有些小事想和你说', emoji:'💬', color:'#7c98d0', message:'今天想和你聊聊天，听听你的声音。' },
  { id:'quiet', title:'需要安静', subtitle:'不是不理你，只是充会儿电', emoji:'🌙', color:'#8a819f', message:'我今天需要安静充充电，但还是很爱你。' },
  { id:'happy', title:'今天开心', subtitle:'想把好心情分你一半', emoji:'☀️', color:'#e5a84a', message:'今天心情很好，想把这份开心分给你。' },
  { id:'miss', title:'想念你', subtitle:'在普通的一天想起你', emoji:'🫶', color:'#c96778', message:'今天很想你。' }
]

const signalFor = (id:string) => signals.find(x => x.id === id) ?? signals[0]

export function SignalLamp({ onBack }: { onBack: () => void }) {
  const [session, setSession] = useState<Session | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)
  const [authNotice, setAuthNotice] = useState('')
  const [roomId, setRoomId] = useState(() => localStorage.getItem('couple-room-id') ?? '')
  const [invite, setInvite] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [roomNotice, setRoomNotice] = useState('')
  const [items, setItems] = useState<RemoteSignal[]>([])
  const [selected, setSelected] = useState('hug')
  const [note, setNote] = useState('')
  const [copied, setCopied] = useState(false)
  const signal = useMemo(() => signalFor(selected), [selected])
  const mine = items.find(item => item.sender_id === session?.user.id)
  const partner = items.find(item => item.sender_id !== session?.user.id)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!supabase || !session || !roomId) return
    const client = supabase
    const load = async () => {
      const { data, error } = await client.from('signals').select('*').eq('room_id', roomId).order('created_at', { ascending:false }).limit(50)
      if (error) setRoomNotice(`无法读取信号：${error.message}`); else setItems(data as RemoteSignal[])
      const { data: room } = await client.from('couple_rooms').select('invite_code').eq('id', roomId).single()
      if (room?.invite_code) setInvite(room.invite_code)
    }
    load()
    const channel = client.channel(`signal-room-${roomId}`).on('postgres_changes', { event:'INSERT', schema:'public', table:'signals', filter:`room_id=eq.${roomId}` }, payload => setItems(old => [payload.new as RemoteSignal, ...old])).subscribe()
    return () => { client.removeChannel(channel) }
  }, [session, roomId])

  const authenticate = async () => {
    if (!supabase) return
    if (password.length < 8) { setAuthNotice('密码至少需要 8 位。'); return }
    const { error } = isRegistering
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password })
    setAuthNotice(error ? error.message : (isRegistering ? '注册成功，正在登录。' : '登录成功。'))
  }
  const createRoom = async () => {
    if (!supabase || !session) return
    setRoomNotice('')
    const { data: room, error } = await supabase.from('couple_rooms').insert({ owner_id:session.user.id }).select('id,invite_code').single()
    if (error || !room) { setRoomNotice(error?.message ?? '创建房间失败'); return }
    const { error: memberError } = await supabase.from('room_members').insert({ room_id:room.id, user_id:session.user.id })
    if (memberError) { setRoomNotice(memberError.message); return }
    localStorage.setItem('couple-room-id', room.id); setRoomId(room.id); setInvite(room.invite_code); setRoomNotice('房间已创建，把邀请码发给对方。')
  }
  const joinRoom = async () => {
    if (!supabase || !joinCode.trim()) return
    setRoomNotice('')
    const { data, error } = await supabase.rpc('join_room_by_code', { code:joinCode.trim() })
    if (error || !data) { setRoomNotice(error?.message ?? '邀请码无效'); return }
    localStorage.setItem('couple-room-id', data); setRoomId(data); setRoomNotice('已加入二人房间，正在同步信号。')
  }
  const saveSignal = async () => {
    if (!supabase || !session || !roomId) return
    const { error } = await supabase.from('signals').insert({ room_id:roomId, sender_id:session.user.id, kind:selected, note:note.trim() })
    if (error) setRoomNotice(`发送失败：${error.message}`); else { setNote(''); setRoomNotice('信号已同步给对方。') }
  }
  const copyInvite = async () => { await navigator.clipboard.writeText(invite); setRoomNotice('邀请码已复制，发到微信给对方即可。') }
  const copySignal = async () => { await navigator.clipboard.writeText(`恋爱信号灯 · ${signal.emoji} ${signal.title}\n${note.trim() || signal.message}`); setCopied(true) }

  if (!supabase) return <main className="signalPage"><nav><button className="back" onClick={onBack}><ArrowLeft size={18} /> 返回词典</button><div className="brand"><Heart fill="#ca5a62" /> 恋爱信号灯</div></nav><section className="setupBox"><h2>还差一步连接 Supabase</h2><p>在项目根目录复制 <code>.env.example</code> 为 <code>.env.local</code>，填入 Project URL 与 Publishable/anon key 后重启开发服务。</p></section></main>
  if (!session) return <main className="signalPage"><nav><button className="back" onClick={onBack}><ArrowLeft size={18} /> 返回词典</button><div className="brand"><Heart fill="#ca5a62" /> 恋爱信号灯</div><span className="privacy"><LockKeyhole size={15} /> 私密二人空间</span></nav><section className="authBox"><KeyRound size={30}/><h1>{isRegistering ? '创建你的小账户' : '登录恋爱信号灯'}</h1><p>{isRegistering ? '首次使用时注册；不发送验证码邮件。' : '使用你注册时的邮箱和密码登录。'}</p><input type="email" placeholder="你的邮箱" value={email} onChange={e => setEmail(e.target.value)} /><input type="password" placeholder="密码（至少 8 位）" value={password} onChange={e => setPassword(e.target.value)} /><button onClick={authenticate}>{isRegistering ? '注册并登录' : '登录'}</button><button className="authSwitch" onClick={() => { setIsRegistering(value => !value); setAuthNotice('') }}>{isRegistering ? '已有账户？去登录' : '第一次使用？创建账户'}</button>{authNotice && <small>{authNotice}</small>}</section></main>
  if (!roomId) return <main className="signalPage"><nav><button className="back" onClick={onBack}><ArrowLeft size={18} /> 返回词典</button><div className="brand"><Heart fill="#ca5a62" /> 恋爱信号灯</div><button className="back" onClick={() => void supabase!.auth.signOut()}><LogOut size={16}/> 退出</button></nav><section className="pairBox"><div className="eyebrow"><Users size={14}/> 只需配对一次</div><h1>创建你们的二人房间</h1><p>一人创建并发送邀请码；另一人登录后输入邀请码加入。</p><div><button onClick={createRoom}>创建房间</button><span>或</span><input placeholder="输入对方发来的邀请码" value={joinCode} onChange={e => setJoinCode(e.target.value)} /><button className="join" onClick={joinRoom}>加入房间</button></div>{roomNotice && <small>{roomNotice}</small>}</section></main>
  return <main className="signalPage"><nav><button className="back" onClick={onBack}><ArrowLeft size={18} /> 返回词典</button><div className="brand"><Heart fill="#ca5a62" /> 恋爱信号灯</div><span className="privacy"><LockKeyhole size={15} /> 仅同步二人信号</span></nav><section className="signalShell"><div className="signalIntro"><div className="eyebrow"><Sparkles size={14} /> A SMALL WAY TO SAY IT</div><h1>不必想很久，<br/>也能让对方知道你的心情。</h1><p>{partner ? `对方刚刚点亮：${signalFor(partner.kind).emoji} ${signalFor(partner.kind).title}` : '选一个信号，点亮给对方。'}</p></div>{invite && <div className="invite"><Link size={16}/><span>邀请码：<b>{invite}</b></span><button onClick={copyInvite}>复制给对方</button></div>}<div className="signalLayout"><div className="signalChoices">{signals.map(item => <button key={item.id} className={selected === item.id ? 'signalChoice active' : 'signalChoice'} onClick={() => { setSelected(item.id); setCopied(false) }}><span style={{ background:item.color }}>{item.emoji}</span><b>{item.title}</b><small>{item.subtitle}</small></button>)}</div><div className="signalCard" style={{ '--signal':signal.color } as React.CSSProperties}><div className="lampGlow">{signal.emoji}</div><div className="cardLabel">TODAY'S SIGNAL</div><h2>{signal.title}</h2><p>{note.trim() || signal.message}</p><textarea value={note} onChange={e => setNote(e.target.value)} maxLength={80} placeholder="想再留一句话给对方吗？（选填）"/><div className="signalActions"><button className="saveSignal" onClick={saveSignal}><Check size={17}/> 同步给对方</button><button className="copySignal" onClick={copySignal}><Copy size={16}/> {copied ? '已复制' : '复制到微信'}</button></div></div></div>{mine && <p className="savedHint">你最近的信号：{signalFor(mine.kind).emoji} {signalFor(mine.kind).title}{mine.note ? ` · ${mine.note}` : ''}</p>}{roomNotice && <p className="savedHint">{roomNotice}</p>}</section></main>
}
