import type { DnsAnswer } from "./types"

/** sing-box lines look like `DEBUG[96894] [2023573158 0ms] dns: ...`; the bracketed ID groups one query */
const LINE_RE = /^(?:TRACE|DEBUG|INFO|WARN|ERROR|FATAL|PANIC)\[\d+\] \[(\d+) [^\]]*\] (.*)$/
// eslint-disable-next-line no-control-regex -- ANSI color codes come from the sing-box log stream
const ANSI_RE = /\u001b\[[0-9;]*m/g
const QUERY_RE = /^dns: (?:exchange|lookup domain) (\S+?)\.?(?: IN A)?$/
const MATCH_RE = /^dns: match\[\d+\] .* => route\((.+)\)$/
const RCODE_RE = /^dns: (?:cached|exchanged) (\S+?)\.? (\S+) \d+$/
const ANSWER_RE = /^dns: (?:cached|exchanged) (\S+) (\S+)\. (\d+) IN (\S+) (.+)$/

const RCODE: Map<string, number> = new Map([
  ["NOERROR", 0],
  ["FORMERR", 1],
  ["SERVFAIL", 2],
  ["NXDOMAIN", 3],
  ["NOTIMP", 4],
  ["REFUSED", 5],
])

export interface SingboxDnsLog {
  answers: DnsAnswer[]
  /** null when the response code line is absent or unrecognized */
  rcode: number | null
  /** DNS server tag from the `match ... => route(TAG)` line; null when absent */
  upstream: string | null
}

interface LogMessage {
  ctx: string
  text: string
}

function toMessages(lines: string[]): LogMessage[] {
  return lines.flatMap((raw) => {
    const m = LINE_RE.exec(raw.replace(ANSI_RE, ""))
    return m ? [{ ctx: m[1], text: m[2] }] : []
  })
}

function isQueryFor(text: string, host: string): boolean {
  const m = QUERY_RE.exec(text)
  return m !== null && m[1].toLowerCase() === host
}

/**
 * Parses the latest query for `target` from sing-box log lines.
 * Returns null when no query for the target appears in the lines.
 */
export function parseSingboxDnsLogs(lines: string[], target: string): SingboxDnsLog | null {
  const host = target.toLowerCase()
  const messages = toMessages(lines)
  const query = messages.filter((m) => isQueryFor(m.text, host)).at(-1)
  if (!query) return null

  const answers: DnsAnswer[] = []
  let rcode: number | null = null
  let upstream: string | null = null
  for (const { ctx, text } of messages) {
    if (ctx !== query.ctx) continue
    const answer = ANSWER_RE.exec(text)
    if (answer) {
      answers.push({ type: answer[4], data: answer[5], ttl: Number(answer[3]) })
      continue
    }
    const code = RCODE_RE.exec(text)
    if (code && code[1].toLowerCase() === host) {
      rcode = RCODE.get(code[2]) ?? null
      continue
    }
    const match = MATCH_RE.exec(text)
    if (match) upstream = match[1]
  }
  return { answers, rcode, upstream }
}
