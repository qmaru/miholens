export interface DnsLogEvent {
  name: string
  type: string
  server: string
  /** 'resolve' starts a query; 'answer' carries the result */
  kind: "resolve" | "answer"
}

const RESOLVE_RE = /\[DNS\] resolve (\S+) (\S+) from (\S+)/
const ANSWER_RE = /\[DNS\] (\S+) --> \[[^\]]*\] (\S+) from (\S+)/
const SINGBOX_QUERY_RE = /^dns: exchange (\S+?)\.? IN (\S+)$/
const SINGBOX_MATCH_RE = /^dns: match\[\d+\] .* => route\((.+)\)$/

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

/**
 * Parser for one `/logs` stream. Besides mihomo's `[DNS]` lines it reads sing-box's compatible
 * endpoint, which reports a query (`dns: exchange X IN A`) and then the route it matched
 * (`dns: match ... => route(TAG)`). The two lines are paired into one resolve event.
 */
export function createDnsLogParser(): (payload: string) => DnsLogEvent | null {
  let pendingQuery: { name: string; type: string } | null = null
  return (payload) => {
    const query = SINGBOX_QUERY_RE.exec(payload)
    if (query) {
      pendingQuery = { name: query[1], type: query[2] }
      return null
    }
    const match = SINGBOX_MATCH_RE.exec(payload)
    if (match && pendingQuery) {
      const { name, type } = pendingQuery
      pendingQuery = null
      return { name, type, server: match[1], kind: "resolve" }
    }
    return parseDnsLogLine(payload)
  }
}
