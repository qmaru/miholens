import { describe, expect, it } from "vitest"

import { buildSingboxDiagnosis } from "./singboxDiagnose"

import type { RawConnection } from "../api/client"
import type { ProxyNode } from "./proxyChain"

const connection = (overrides: Partial<RawConnection> & { chains: string[] }): RawConnection => ({
  id: "c1",
  metadata: {
    host: "example.com",
    destinationIP: "",
    destinationPort: "443",
    network: "tcp",
    sourceIP: "192.168.1.2",
    dnsMode: "",
    type: "inbound/tun",
  },
  rule: "domain_suffix",
  rulePayload: "example.com",
  start: "2024-01-01T00:00:00Z",
  ...overrides,
})

const proxies: Record<string, ProxyNode> = {
  PROXY: { name: "PROXY", type: "selector", now: "node-a" },
  "node-a": { name: "node-a", type: "shadowsocks" },
}

const DNS_LINES = [
  "DEBUG[96894] [2023573158 0ms] dns: exchange example.com. IN A",
  "DEBUG[96894] [2023573158 0ms] dns: match[11] rule_set=[user-proxy] => route(global-dns)",
  "DEBUG[96894] [2023573158 0ms] dns: cached example.com NOERROR 277",
  "INFO[96894] [2023573158 0ms] dns: cached A example.com. 277 IN A 93.184.216.34",
]

describe("buildSingboxDiagnosis", () => {
  it("builds DNS, rule, proxy, and probe fields for a domain", () => {
    const result = buildSingboxDiagnosis({
      target: "example.com",
      connections: [connection({ chains: ["node-a", "PROXY"] })],
      proxies,
      logLines: DNS_LINES,
    })

    expect(result.dns.answers).toEqual({
      value: [{ type: "A", data: "93.184.216.34", ttl: 277 }],
      status: "observed",
      source: "logs-grpc",
    })
    expect(result.dns.rcode.value).toBe(0)
    expect(result.dns.upstream.value).toBe("global-dns")
    expect(result.rules.kernelHit.value).toMatchObject({
      index: null,
      type: "domain_suffix",
      payload: "example.com",
      proxy: "PROXY",
    })
    expect(result.proxy.rootGroup.value).toBe("PROXY")
    expect(result.proxy.chain.value).toEqual(["PROXY", "node-a"])
    expect(result.probe.status).toBe("observed")
    expect(result.notes).toEqual([{ key: "dns.singboxLogNote" }])
  })

  it("marks a final-route connection as unavailable with the sing-box reason", () => {
    const result = buildSingboxDiagnosis({
      target: "example.com",
      connections: [connection({ rule: "", rulePayload: "", chains: ["direct"] })],
      proxies: {},
      logLines: DNS_LINES,
    })

    expect(result.rules.kernelHit.status).toBe("unavailable")
    expect(result.rules.kernelHit.reason).toEqual({ key: "rule.singboxFinal" })
    expect(result.proxy.rootGroup.value).toBe("direct")
  })

  it("reports no connection when none matches the target", () => {
    const result = buildSingboxDiagnosis({
      target: "example.com",
      connections: [],
      proxies,
      logLines: DNS_LINES,
    })

    expect(result.rules.kernelHit.reason).toEqual({ key: "rule.noConnection" })
    expect(result.proxy.rootGroup.reason).toEqual({ key: "proxy.noRootGroup" })
    expect(result.probe.reason).toEqual({ key: "connection.none" })
  })

  it("marks DNS unavailable when no query is in the log buffer", () => {
    const result = buildSingboxDiagnosis({
      target: "example.com",
      connections: [],
      proxies,
      logLines: [],
    })

    expect(result.dns.answers.reason).toEqual({ key: "dns.noQueryLog" })
    expect(result.dns.rcode.reason).toEqual({ key: "dns.noQueryLog" })
    expect(result.dns.upstream.reason).toEqual({ key: "dns.noQueryLog" })
  })

  it("reports a missing rcode and upstream line as not in the buffer", () => {
    const result = buildSingboxDiagnosis({
      target: "example.com",
      connections: [],
      proxies,
      logLines: [
        "DEBUG[96894] [2023573158 0ms] dns: exchange example.com. IN A",
        "INFO[96894] [2023573158 0ms] dns: cached A example.com. 277 IN A 93.184.216.34",
      ],
    })

    expect(result.dns.answers.status).toBe("observed")
    expect(result.dns.rcode.reason).toEqual({ key: "dns.noLogLine" })
    expect(result.dns.upstream.reason).toEqual({ key: "dns.noLogLine" })
  })

  it("marks DNS unavailable for an IP target", () => {
    const result = buildSingboxDiagnosis({
      target: "93.184.216.34",
      connections: [],
      proxies,
      logLines: DNS_LINES,
    })

    expect(result.targetKind).toBe("ip")
    expect(result.dns.answers.reason).toEqual({ key: "dns.ipTarget" })
    expect(result.notes).toEqual([])
  })
})
