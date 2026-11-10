import type { ProxyNode } from "../diagnostics/proxyChain"
import type { RuleEntry } from "../diagnostics/types"
import type { Message } from "../i18n/messages"

export interface MihomoConfig {
  /** For example http://127.0.0.1:9090 */
  baseUrl: string
  secret: string
}

export interface RawConnection {
  id: string
  metadata: {
    host: string
    destinationIP: string
    destinationPort: string
    network: string
    sourceIP: string
    dnsMode: string
    type: string
    process?: string
  }
  rule: string
  rulePayload: string
  chains: string[]
  start: string
}

export interface RawRule {
  index: number
  type: string
  payload: string
  proxy: string
  extra?: { disabled?: boolean; hitCount?: number }
}

export interface RawDnsResponse {
  Status: number
  Answer?: { name: string; type: number; TTL: number; data: string }[]
}

/** HTTP failure from the Mihomo API; `detail` is a translatable message */
export class MihomoApiError extends Error {
  detail: Message

  constructor(detail: Message) {
    super(detail.key)
    this.detail = detail
  }
}

/** Upper bound for one REST call, so an unreachable host fails instead of hanging */
const REQUEST_TIMEOUT_MS = 5000

export class MihomoClient {
  constructor(private readonly config: MihomoConfig) {}

  private url(path: string): string {
    return `${this.config.baseUrl.replace(/\/$/, "")}${path}`
  }

  private async request(
    path: string,
    init: { method?: string; body?: string } = {},
  ): Promise<Response> {
    const res = await fetch(this.url(path), {
      ...init,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${this.config.secret}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
    })
    if (!res.ok) {
      throw new MihomoApiError({ key: "error.http", params: { path, status: res.status } })
    }
    return res
  }

  private async getJson<T>(path: string): Promise<T> {
    const res = await this.request(path)
    return (await res.json()) as T
  }

  /** Clears the kernel DNS answer cache so the next query reaches an upstream server */
  async flushDnsCache(): Promise<void> {
    await this.request("/cache/dns/flush", { method: "POST" })
  }

  async getRules(): Promise<RuleEntry[]> {
    const data = await this.getJson<{ rules: RawRule[] }>("/rules")
    return data.rules.map((r) => ({
      index: r.index,
      type: r.type,
      payload: r.payload,
      proxy: r.proxy,
      disabled: r.extra?.disabled ?? false,
    }))
  }

  async getProxies(): Promise<Record<string, ProxyNode>> {
    const data = await this.getJson<{ proxies: Record<string, ProxyNode> }>("/proxies")
    return data.proxies
  }

  /** Provider nodes (proxy-providers) are not in /proxies and must be fetched separately */
  async getProviderProxies(): Promise<Record<string, ProxyNode>> {
    const data = await this.getJson<{ providers: Record<string, { proxies: ProxyNode[] | null }> }>(
      "/providers/proxies",
    )
    const nodes: Record<string, ProxyNode> = {}
    for (const provider of Object.values(data.providers)) {
      for (const node of provider.proxies ?? []) nodes[node.name] = node
    }
    return nodes
  }

  async getConnections(): Promise<RawConnection[]> {
    const data = await this.getJson<{ connections: RawConnection[] | null }>("/connections")
    return data.connections ?? []
  }

  async queryDns(name: string, type: string): Promise<RawDnsResponse> {
    const params = new URLSearchParams({ name, type })
    return this.getJson<RawDnsResponse>(`/dns/query?${params.toString()}`)
  }

  /**
   * Subscribe to the kernel debug log. Resolves with a close function once the socket is open,
   * so logs emitted by a following query are not missed. The `level=debug` filter streams DNS lines
   * even when the kernel's configured log-level is `silent`.
   * `onFailure` fires if the socket errors, closes, or does not open in time, before the caller stops it.
   */
  watchLogs(onPayload: (payload: string) => void, onFailure: () => void): Promise<() => void> {
    const wsBase = this.config.baseUrl.replace(/^http/, "ws").replace(/\/$/, "")
    const params = new URLSearchParams({ level: "debug", token: this.config.secret })
    const socket = new WebSocket(`${wsBase}/logs?${params.toString()}`)
    let stopped = false
    let openTimer: ReturnType<typeof setTimeout> | undefined
    const stop = () => {
      stopped = true
      clearTimeout(openTimer)
      socket.close()
    }
    return new Promise((resolve) => {
      const fail = () => {
        clearTimeout(openTimer)
        if (!stopped) onFailure()
        resolve(stop)
      }
      openTimer = setTimeout(() => {
        socket.close()
      }, REQUEST_TIMEOUT_MS)
      socket.onopen = () => {
        clearTimeout(openTimer)
        resolve(stop)
      }
      socket.onmessage = (event: MessageEvent<string>) => {
        const line = JSON.parse(event.data) as { payload: string }
        onPayload(line.payload)
      }
      socket.onerror = fail
      socket.onclose = fail
    })
  }
}
