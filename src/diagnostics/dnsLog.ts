export interface DnsLogEvent {
  name: string
  type: string
  server: string
  /** 'resolve' starts a query; 'answer' carries the result */
  kind: "resolve" | "answer"
}

const RESOLVE_RE = /\[DNS\] resolve (\S+) (\S+) from (\S+)/
const ANSWER_RE = /\[DNS\] (\S+) --> \[[^\]]*\] (\S+) from (\S+)/

/** Parse `[DNS]` lines from the mihomo debug log; other lines are ignored */
export function parseDnsLogLine(payload: string): DnsLogEvent | null {
  const resolve = RESOLVE_RE.exec(payload)
  if (resolve) {
    return { name: resolve[1], type: resolve[2], server: resolve[3], kind: "resolve" }
  }
  const answer = ANSWER_RE.exec(payload)
  if (answer) {
    return { name: answer[1], type: answer[2], server: answer[3], kind: "answer" }
  }
  return null
}
