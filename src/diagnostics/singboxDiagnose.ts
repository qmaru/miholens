import { SingboxClient } from "../api/singbox/client"
import {
  classifyTarget,
  connectionEvidence,
  correlateChain,
  matchConnection,
  observed,
  traceOutcome,
  unavailable,
} from "./diagnose"
import { parseSingboxDnsLogs } from "./singboxDnsLog"

import type { RawConnection } from "../api/client"
import type { Message } from "../i18n/messages"
import type { SourceSet, TraceEvent } from "./diagnose"
import type { ProxyNode } from "./proxyChain"
import type { DiagnosisResult, Field, RuleMatch } from "./types"

export interface SingboxDiagnosisInput {
  target: string
  connections: RawConnection[]
  proxies: Record<string, ProxyNode>
  /** Buffered log lines from the sing-box log stream */
  logLines: string[]
}

const SINGBOX_SOURCES: SourceSet = {
  connections: "connections-grpc",
  proxies: "proxies-grpc",
  providers: "proxies-grpc",
}

/**
 * sing-box has no rule list, DNS query, or DNS flush API. Rule index stays null, and DNS fields come
 * from the buffered log lines only. The root group is the last entry of the connection's chain.
 */
export function buildSingboxDiagnosis(
  input: SingboxDiagnosisInput,
  startedAt = new Date().toISOString(),
): DiagnosisResult {
  const { target, connections, proxies, logLines } = input
  const targetKind = classifyTarget(target)
  const notes: Message[] = []
  const conn = matchConnection(connections, target, targetKind)

  let dns: DiagnosisResult["dns"]
  if (targetKind === "ip") {
    const reason: Message = { key: "dns.ipTarget" }
    dns = {
      answers: unavailable("logs-grpc", reason),
      rcode: unavailable("logs-grpc", reason),
      upstream: unavailable("logs-grpc", reason),
    }
  } else {
    const dnsLog = parseSingboxDnsLogs(logLines, target)
    const noQuery: Message = { key: "dns.noQueryLog" }
    const noLine: Message = { key: "dns.noLogLine" }
    dns = {
      answers:
        dnsLog && dnsLog.answers.length > 0
          ? observed(dnsLog.answers, "logs-grpc")
          : unavailable("logs-grpc", noQuery),
      rcode: dnsLog
        ? dnsLog.rcode !== null
          ? observed(dnsLog.rcode, "logs-grpc")
          : unavailable("logs-grpc", noLine)
        : unavailable("logs-grpc", noQuery),
      upstream: dnsLog
        ? dnsLog.upstream !== null
          ? observed(dnsLog.upstream, "logs-grpc")
          : unavailable("logs-grpc", noLine)
        : unavailable("logs-grpc", noQuery),
    }
    notes.push({ key: "dns.singboxLogNote" })
  }

  let kernelHit: Field<RuleMatch>
  let rootGroup: Field<string>
  const root = conn?.chains[conn.chains.length - 1] ?? null
  if (conn === null) {
    kernelHit = unavailable("connections-grpc", { key: "rule.noConnection" })
    rootGroup = unavailable("connections-grpc", { key: "proxy.noRootGroup" })
  } else {
    if (root === null) {
      rootGroup = unavailable("connections-grpc", { key: "proxy.noRootGroup" })
    } else {
      rootGroup = observed(root, "connections-grpc")
    }
    if (conn.rule === "") {
      kernelHit = unavailable("connections-grpc", { key: "rule.singboxFinal" })
    } else if (root === null) {
      kernelHit = unavailable("connections-grpc", { key: "proxy.noRootGroup" })
    } else {
      kernelHit = observed(
        { index: null, type: conn.rule, payload: conn.rulePayload, proxy: root },
        "connections-grpc",
      )
    }
  }

  const { chain, leafType, observedChain } = correlateChain({
    rootGroup,
    conn,
    proxies,
    sources: SINGBOX_SOURCES,
    notes,
  })

  return {
    target,
    targetKind,
    startedAt,
    dns,
    rules: { kernelHit },
    proxy: { rootGroup, chain, leafType, observedChain },
    probe: conn
      ? observed(connectionEvidence(conn), "connections-grpc")
      : unavailable("connections-grpc", { key: "connection.none" }),
    notes,
  }
}

/** Live collection over gRPC; the DNS log is read only for domain targets */
export async function runSingboxDiagnosis(
  client: SingboxClient,
  target: string,
  options: { onTrace?: (event: TraceEvent) => void } = {},
): Promise<DiagnosisResult> {
  const startedAt = new Date().toISOString()
  const trace = options.onTrace ?? (() => undefined)
  const isDomain = classifyTarget(target) === "domain"
  const [connections, proxies, logLines] = await Promise.all([
    client.getConnections(),
    client.getProxies(),
    isDomain ? client.getLogLines() : Promise.resolve([]),
  ])
  trace({
    stage: "CONN",
    message: {
      key: "trace.singboxLoaded",
      params: { proxies: Object.keys(proxies).length, connections: connections.length },
    },
    ok: true,
  })
  if (isDomain) {
    trace({
      stage: "DNS",
      message: { key: "trace.singboxLogs", params: { count: logLines.length } },
      ok: logLines.length > 0,
    })
  }
  const diagnosis = buildSingboxDiagnosis({ target, connections, proxies, logLines }, startedAt)
  traceOutcome(diagnosis, trace)
  return diagnosis
}
