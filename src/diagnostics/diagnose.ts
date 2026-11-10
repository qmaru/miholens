import { parseDnsLogLine } from "./dnsLog"
import { chainsMatchRootFirst, resolveProxyChain } from "./proxyChain"

import type { MihomoClient, RawConnection, RawDnsResponse } from "../api/client"
import type { Message } from "../i18n/messages"
import type { DnsLogEvent } from "./dnsLog"
import type { ProxyNode } from "./proxyChain"
import type {
  ConnectionEvidence,
  DiagnosisResult,
  DnsAnswer,
  Field,
  RuleEntry,
  RuleMatch,
} from "./types"

export interface DiagnosisInput {
  target: string
  rules: RuleEntry[]
  proxies: Record<string, ProxyNode>
  /** Provider nodes from /providers/proxies; /proxies entries take precedence on conflicts */
  providerProxies?: Record<string, ProxyNode>
  connections: RawConnection[]
  /** DNS query result; null when the target is an IP */
  dnsResponse: RawDnsResponse | null
  /** DNS log events captured during the query */
  dnsLogEvents: DnsLogEvent[]
  /** True when the /logs WebSocket errored or closed during the query */
  logStreamFailed?: boolean
}

const IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/

/** Reduces a pasted URL or host:port to the bare host, e.g. "https://a.com:443/x" -> "a.com" */
export function normalizeTarget(input: string): string {
  const withoutScheme = input.trim().replace(/^[a-z][a-z0-9+.-]*:\/\//i, "")
  const host = withoutScheme.split("/")[0]
  // A single colon means host:port; more colons are an IPv6 literal and stay intact
  const parts = host.split(":")
  return parts.length === 2 ? parts[0] : host
}

export function classifyTarget(target: string): "domain" | "ip" {
  return IPV4_RE.test(target) || target.includes(":") ? "ip" : "domain"
}

function observed<T>(value: T, source: Field<T>["source"]): Field<T> {
  return { value, status: "observed", source }
}

function unavailable<T>(source: Field<T>["source"], reason: Message): Field<T> {
  return { value: null, status: "unavailable", source, reason }
}

const DNS_TYPE_NAME: Record<number, string> = {
  1: "A",
  2: "NS",
  5: "CNAME",
  15: "MX",
  16: "TXT",
  28: "AAAA",
  65: "HTTPS",
}

function toDnsAnswers(response: RawDnsResponse): DnsAnswer[] {
  return (response.Answer ?? []).map((a) => ({
    type: DNS_TYPE_NAME[a.type] ?? String(a.type),
    data: a.data,
    ttl: a.TTL,
  }))
}

/** Map the rule recorded on the connection to its index and proxy group in /rules */
function findRule(rules: RuleEntry[], rule: string, payload: string): RuleMatch | null {
  const found = rules.find((r) => r.type === rule && r.payload === payload)
  return found
    ? { index: found.index, type: found.type, payload: found.payload, proxy: found.proxy }
    : null
}

function connectionEvidence(conn: RawConnection): ConnectionEvidence {
  return {
    id: conn.id,
    host: conn.metadata.host,
    destinationIP: conn.metadata.destinationIP,
    destinationPort: conn.metadata.destinationPort,
    rule: conn.rule,
    rulePayload: conn.rulePayload,
    chains: conn.chains,
  }
}

/**
 * Pure correlation function: merges DNS, rule, proxy, connection, and log data into one diagnosis.
 * Each field's status/source reflects the actual data origin; nothing is inferred or filled in.
 */
export function buildDiagnosis(
  input: DiagnosisInput,
  startedAt = new Date().toISOString(),
): DiagnosisResult {
  const { target, rules, proxies, providerProxies, connections, dnsResponse, dnsLogEvents } = input
  const { logStreamFailed = false } = input
  const targetKind = classifyTarget(target)
  const notes: Message[] = []

  // Matching kernel connection; use the most recent one.
  // "Inner" connections are the kernel's own DNS upstream sessions, not the user's traffic.
  const matchedConns = connections
    .filter(
      (c) =>
        c.metadata.type !== "Inner" &&
        (targetKind === "domain"
          ? c.metadata.host === target
          : c.metadata.destinationIP === target),
    )
    .sort((a, b) => b.start.localeCompare(a.start))
  const conn = matchedConns[0] ?? null

  // DNS
  let dns: DiagnosisResult["dns"]
  if (targetKind === "ip" || dnsResponse === null) {
    const reason: Message = { key: "dns.ipTarget" }
    dns = {
      answers: unavailable("dns-query-api", reason),
      rcode: unavailable("dns-query-api", reason),
      upstream: unavailable("logs-ws", reason),
    }
  } else {
    const resolveEvents = dnsLogEvents.filter(
      (e) => e.kind === "resolve" && e.name.replace(/\.$/, "") === target,
    )
    const lastResolve = resolveEvents[resolveEvents.length - 1]
    dns = {
      answers: observed(toDnsAnswers(dnsResponse), "dns-query-api"),
      rcode: observed(dnsResponse.Status, "dns-query-api"),
      upstream: lastResolve
        ? observed(lastResolve.server, "logs-ws")
        : unavailable(
            "logs-ws",
            logStreamFailed ? { key: "dns.logStreamFailed" } : { key: "dns.noUpstreamLog" },
          ),
    }
    notes.push({ key: "dns.fakeIpNote" })
  }

  // Rule: only the rule the kernel actually matched (from the target's connection record)
  let kernelHit: Field<RuleMatch>
  if (conn === null) {
    kernelHit = unavailable("connections-api", { key: "rule.noConnection" })
  } else {
    const hit = findRule(rules, conn.rule, conn.rulePayload)
    if (hit) {
      kernelHit = observed(hit, "connections-api")
    } else if (conn.rule === "") {
      kernelHit = unavailable("connections-api", { key: "rule.emptyField" })
    } else {
      kernelHit = unavailable("connections-api", {
        key: "rule.notInRules",
        params: { rule: conn.rule, payload: conn.rulePayload },
      })
    }
  }

  // Proxy chain: rooted at the proxy group of the rule the kernel matched
  const rootGroup: Field<string> = kernelHit.value
    ? observed(kernelHit.value.proxy, "connections-api")
    : unavailable("connections-api", kernelHit.reason ?? { key: "proxy.noRootGroup" })

  let chain: Field<string[]>
  let leafType: Field<string>
  if (rootGroup.value === null) {
    const reason = rootGroup.reason ?? { key: "proxy.noRootGroup" }
    chain = unavailable("proxies-api", reason)
    leafType = unavailable("proxies-api", reason)
  } else {
    const resolved = resolveProxyChain({ ...providerProxies, ...proxies }, rootGroup.value)
    if ("error" in resolved) {
      leafType = unavailable("proxies-api", {
        key: "proxy.leafUnavailable",
        params: { cause: resolved.error },
      })
      chain = conn
        ? observed([...conn.chains].reverse(), "connections-api")
        : unavailable("proxies-api", {
            key: "proxy.chainFallbackUnavailable",
            params: { cause: resolved.error },
          })
      notes.push({ key: "note.chainExpandFailed", params: { cause: resolved.error } })
    } else {
      const leaf = resolved.chain[resolved.chain.length - 1]
      chain = { value: resolved.chain, status: "observed", source: "proxies-api" }
      leafType = {
        value: resolved.leafType,
        status: "observed",
        source: proxies[leaf] ? "proxies-api" : "providers-api",
      }
    }
  }

  const observedChain: Field<string[]> = conn
    ? observed([...conn.chains].reverse(), "connections-api")
    : unavailable("connections-api", { key: "connection.none" })
  if (conn && chain.value && !chainsMatchRootFirst(conn.chains, chain.value)) {
    notes.push({ key: "note.chainMismatch" })
  }

  return {
    target,
    targetKind,
    startedAt,
    dns,
    rules: {
      kernelHit,
    },
    proxy: {
      rootGroup,
      chain,
      leafType,
      observedChain,
    },
    probe: conn
      ? observed(connectionEvidence(conn), "connections-api")
      : unavailable("connections-api", { key: "connection.none" }),
    notes,
  }
}

/**
 * Live collection: query DNS while capturing kernel DNS logs, then fetch rule, proxy, and connection snapshots.
 * With `liveUpstream`, the DNS cache is flushed first. Without the flush, a cached answer produces no upstream log.
 * The `/logs?level=debug` stream emits DNS lines even when the kernel's log-level is `silent`, so the level is not changed.
 */
export async function runDiagnosis(
  client: MihomoClient,
  target: string,
  options: { liveUpstream: boolean },
): Promise<DiagnosisResult> {
  const startedAt = new Date().toISOString()
  const targetKind = classifyTarget(target)
  const dnsLogEvents: DnsLogEvent[] = []
  let dnsResponse: RawDnsResponse | null = null
  let logStreamFailed = false

  if (targetKind === "domain") {
    if (options.liveUpstream) await client.flushDnsCache()
    // Wait for the socket to open; logs emitted before that would be lost
    const stopLogs = await client.watchLogs(
      (payload) => {
        const event = parseDnsLogLine(payload)
        if (event) dnsLogEvents.push(event)
      },
      () => {
        logStreamFailed = true
      },
    )
    try {
      dnsResponse = await client.queryDns(target, "A")
      // Logs arrive asynchronously over the WebSocket; allow a short collection window
      await new Promise((resolve) => setTimeout(resolve, 300))
    } finally {
      stopLogs()
    }
  }

  const [rules, proxies, providerProxies, connections] = await Promise.all([
    client.getRules(),
    client.getProxies(),
    client.getProviderProxies(),
    client.getConnections(),
  ])

  return buildDiagnosis(
    {
      target,
      rules,
      proxies,
      providerProxies,
      connections,
      dnsResponse,
      dnsLogEvents,
      logStreamFailed,
    },
    startedAt,
  )
}
