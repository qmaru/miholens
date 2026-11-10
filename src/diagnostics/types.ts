/**
 * Unified diagnosis data structure.
 *
 * Each conclusion carries `status` and `source`:
 * - status: observed (seen in the kernel) / unavailable (could not be obtained) / not-run
 * - source: where the data came from, so users can judge how much to trust it
 */

import type { Message } from "../i18n/messages"

export type FieldStatus = "observed" | "unavailable" | "not-run"

export type FieldSource =
  | "dns-query-api"
  | "connections-api"
  | "proxies-api"
  | "providers-api"
  | "logs-ws"

/** One rule from the /rules list */
export interface RuleEntry {
  index: number
  type: string
  payload: string
  proxy: string
  disabled: boolean
}

export interface Field<T> {
  value: T | null
  status: FieldStatus
  source: FieldSource
  /** Why the value could not be obtained; rendered directly to the user */
  reason?: Message
}

export interface DnsAnswer {
  type: string
  data: string
  ttl: number
}

export interface DnsResult {
  /** Answer from the kernel's /dns/query (after the kernel's DNS policy and cache) */
  answers: Field<DnsAnswer[]>
  /** Response code; 0 means success */
  rcode: Field<number>
  /** Upstream the kernel actually used (from the debug log `[DNS] resolve ... from <server>`) */
  upstream: Field<string>
}

export interface RuleMatch {
  index: number
  type: string
  payload: string
  proxy: string
}

export interface RuleResult {
  /** Rule the kernel actually matched (from the target's connection rule/rulePayload, aligned with /rules) */
  kernelHit: Field<RuleMatch>
}

export interface ProxyChainResult {
  /** Final proxy group (the proxy name the matched rule points to) */
  rootGroup: Field<string>
  /** Full chain expanded recursively from the group; the last entry is the leaf node */
  chain: Field<string[]>
  /** Type of the leaf node, e.g. Socks5 / Vmess */
  leafType: Field<string>
  /** Proxy chain recorded in the kernel connection data (chains field; the last entry is the final hop) */
  observedChain: Field<string[]>
}

export interface ConnectionEvidence {
  id: string
  host: string
  destinationIP: string
  destinationPort: string
  rule: string
  rulePayload: string
  chains: string[]
}

export interface DiagnosisResult {
  target: string
  targetKind: "domain" | "ip"
  startedAt: string
  dns: DnsResult
  rules: RuleResult
  proxy: ProxyChainResult
  /** Kernel connection matched to this diagnosis (only present when a real connection was found) */
  probe: Field<ConnectionEvidence>
  /** Correlation findings, e.g. whether the connection record matches the /proxies expansion */
  notes: Message[]
}
