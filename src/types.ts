export type Message = { sender: string; content: string; time?: string }
export type Candidate = {
  phrase: string
  count: number
  users: Record<string, number>
  topUser: string
  collocations: string[]
  contexts: Message[]
  score: number
  category: '昵称' | '口头禅' | '固定短语' | '共同记忆'
}
