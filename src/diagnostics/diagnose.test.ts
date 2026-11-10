import { describe, expect, it } from "vitest"

import { buildDiagnosis, classifyTarget, normalizeTarget } from "./diagnose"
import { parseDnsLogLine } from "./dnsLog"
import { chainsMatchRootFirst, resolveProxyChain, type ProxyNode } from "./proxyChain"

import type { RuleEntry } from "./types"

const rule = (
  index: number,
  type: string,
  payload: string,
  proxy: string,
  disabled = false,
): RuleEntry => ({
  index,
  type,
  payload,
  proxy,
  disabled,
})

describe("resolveProxyChain", () => {
  const proxies: Record<string, ProxyNode> = {
    MEDIA: { name: "MEDIA", type: "Selector", now: "PROXY" },
    PROXY: { name: "PROXY", type: "Selector", now: "node-local" },
    "node-local": { name: "node-local", type: "Socks5" },
  }

  it("expands from the root group to the leaf node", () => {
    expect(resolveProxyChain(proxies, "MEDIA")).toEqual({
      chain: ["MEDIA", "PROXY", "node-local"],
      leafType: "Socks5",
    })
  })

  it("returns the specific missing node on error", () => {
    expect(resolveProxyChain(proxies, "NOPE")).toEqual({
      error: { key: "chain.nodeMissing", params: { name: "NOPE" } },
    })
  })

  it("names the missing child when it is in neither /proxies nor /providers/proxies", () => {
    const dangling: Record<string, ProxyNode> = {
      MEDIA: { name: "MEDIA", type: "Selector", now: "GONE" },
    }
    expect(resolveProxyChain(dangling, "MEDIA")).toEqual({
      error: { key: "chain.nodeMissing", params: { name: "GONE" } },
    })
  })

  it("returns a specific reason for a cycle", () => {
    const loop: Record<string, ProxyNode> = {
      A: { name: "A", type: "Selector", now: "B" },
      B: { name: "B", type: "Selector", now: "A" },
    }
    expect(resolveProxyChain(loop, "A")).toEqual({
      error: { key: "chain.loop", params: { name: "A" } },
    })
  })

  it("compares connection chains (leaf first) with the root-to-leaf chain", () => {
    expect(
      chainsMatchRootFirst(["node-local", "PROXY", "MEDIA"], ["MEDIA", "PROXY", "node-local"]),
    ).toBe(true)
    expect(chainsMatchRootFirst(["node-local", "PROXY"], ["MEDIA", "PROXY", "node-local"])).toBe(
      false,
    )
  })
})

describe("parseDnsLogLine", () => {
  it("parses a resolve line", () => {
    expect(parseDnsLogLine("[DNS] resolve example.com A from udp://223.5.5.5:53")).toEqual({
      name: "example.com",
      type: "A",
      server: "udp://223.5.5.5:53",
      kind: "resolve",
    })
  })

  it("parses an answer line", () => {
    expect(
      parseDnsLogLine("[DNS] example.com. --> [1.2.3.4] A from https://1.1.1.1:443/dns-query"),
    ).toMatchObject({
      name: "example.com.",
      kind: "answer",
      server: "https://1.1.1.1:443/dns-query",
    })
  })

  it("returns null for non-DNS lines", () => {
    expect(parseDnsLogLine("[TCP] dial PROXY")).toBeNull()
  })
})

describe("classifyTarget", () => {
  it("distinguishes domains from IPs", () => {
    expect(classifyTarget("example.com")).toBe("domain")
    expect(classifyTarget("1.2.3.4")).toBe("ip")
    expect(classifyTarget("2001:db8::1")).toBe("ip")
  })
})

describe("normalizeTarget", () => {
  it("strips scheme, path, and port from pasted input", () => {
    expect(normalizeTarget("https://ip111.cn/")).toBe("ip111.cn")
    expect(normalizeTarget(" example.com:443/path ")).toBe("example.com")
    expect(normalizeTarget("example.com")).toBe("example.com")
  })

  it("keeps IP literals intact", () => {
    expect(normalizeTarget("1.2.3.4")).toBe("1.2.3.4")
    expect(normalizeTarget("2001:db8::1")).toBe("2001:db8::1")
  })

  it("does not classify a URL's scheme colon as IPv6", () => {
    expect(classifyTarget(normalizeTarget("https://ip111.cn/"))).toBe("domain")
  })
})

describe("buildDiagnosis", () => {
  const rules = [rule(0, "DomainSuffix", "example.com", "MEDIA"), rule(1, "Match", "", "PROXY")]
  const proxies: Record<string, ProxyNode> = {
    MEDIA: { name: "MEDIA", type: "Selector", now: "PROXY" },
    PROXY: { name: "PROXY", type: "Selector", now: "node-local" },
    "node-local": { name: "node-local", type: "Socks5" },
  }
  const conn = {
    id: "c1",
    metadata: {
      host: "www.example.com",
      destinationIP: "1.2.3.4",
      destinationPort: "443",
      network: "tcp",
      sourceIP: "127.0.0.1",
      dnsMode: "normal",
      type: "HTTP",
    },
    rule: "DomainSuffix",
    rulePayload: "example.com",
    chains: ["node-local", "PROXY", "MEDIA"],
    start: "2026-01-01T00:00:00Z",
  }

  it("ignores kernel-internal Inner connections when matching the target", () => {
    const result = buildDiagnosis({
      target: "8.8.8.8",
      rules,
      proxies,
      connections: [
        {
          ...conn,
          id: "inner",
          metadata: { ...conn.metadata, destinationIP: "8.8.8.8", type: "Inner" },
          rule: "",
          rulePayload: "",
        },
      ],
      dnsResponse: null,
      dnsLogEvents: [],
    })
    expect(result.rules.kernelHit.reason).toEqual({ key: "rule.noConnection" })
    expect(result.proxy.rootGroup.status).toBe("unavailable")
  })

  it("reports an empty kernel rule field as its own reason, not as a missing rule", () => {
    const result = buildDiagnosis({
      target: "www.example.com",
      rules,
      proxies,
      connections: [{ ...conn, rule: "", rulePayload: "" }],
      dnsResponse: { Status: 0 },
      dnsLogEvents: [],
    })
    expect(result.rules.kernelHit.reason).toEqual({ key: "rule.emptyField" })
  })

  it("takes the kernel-matched rule and proxy group from the connection record and labels sources", () => {
    const result = buildDiagnosis({
      target: "www.example.com",
      rules,
      proxies,
      connections: [conn],
      dnsResponse: {
        Status: 0,
        Answer: [{ name: "www.example.com.", type: 1, TTL: 60, data: "1.2.3.4" }],
      },
      dnsLogEvents: [
        { name: "www.example.com", type: "A", server: "udp://223.5.5.5:53", kind: "resolve" },
      ],
    })
    expect(result.dns.upstream).toMatchObject({ status: "observed", value: "udp://223.5.5.5:53" })
    expect(result.dns.answers.value).toEqual([{ type: "A", data: "1.2.3.4", ttl: 60 }])
    expect(result.rules.kernelHit).toMatchObject({ status: "observed", source: "connections-api" })
    expect(result.rules.kernelHit.value?.index).toBe(0)
    expect(result.proxy.rootGroup).toMatchObject({
      status: "observed",
      source: "connections-api",
      value: "MEDIA",
    })
    expect(result.proxy.chain.value).toEqual(["MEDIA", "PROXY", "node-local"])
    expect(result.proxy.observedChain.value).toEqual(["MEDIA", "PROXY", "node-local"])
    expect(result.notes).toEqual([{ key: "dns.fakeIpNote" }])
  })

  it("marks rule and proxy fields as unavailable with a reason when there is no connection", () => {
    const result = buildDiagnosis({
      target: "www.example.com",
      rules,
      proxies,
      connections: [],
      dnsResponse: { Status: 0 },
      dnsLogEvents: [],
    })
    expect(result.rules.kernelHit).toMatchObject({ status: "unavailable", value: null })
    expect(result.rules.kernelHit.reason).toEqual({ key: "rule.noConnection" })
    expect(result.proxy.rootGroup).toMatchObject({ status: "unavailable", value: null })
    expect(result.proxy.chain.status).toBe("unavailable")
    expect(result.proxy.leafType.status).toBe("unavailable")
    expect(result.proxy.observedChain.status).toBe("unavailable")
    expect(result.dns.upstream.status).toBe("unavailable")
  })

  it("reports a failed log stream as its own reason, not as a missing log", () => {
    const result = buildDiagnosis({
      target: "www.example.com",
      rules,
      proxies,
      connections: [],
      dnsResponse: { Status: 0 },
      dnsLogEvents: [],
      logStreamFailed: true,
    })
    expect(result.dns.upstream.reason).toEqual({ key: "dns.logStreamFailed" })
  })

  it("marks the kernel match unavailable when the connection's rule is not in /rules", () => {
    const result = buildDiagnosis({
      target: "www.example.com",
      rules,
      proxies,
      connections: [
        { ...conn, rule: "Match", rulePayload: "stale", chains: ["node-local", "PROXY"] },
      ],
      dnsResponse: { Status: 0 },
      dnsLogEvents: [],
    })
    expect(result.rules.kernelHit).toMatchObject({ status: "unavailable", value: null })
    expect(result.rules.kernelHit.reason).toEqual({
      key: "rule.notInRules",
      params: { rule: "Match", payload: "stale" },
    })
    expect(result.proxy.rootGroup.status).toBe("unavailable")
  })

  it("falls back to the connection's observed chain when the group cannot be expanded", () => {
    const broken: Record<string, ProxyNode> = {
      ...proxies,
      MEDIA: { name: "MEDIA", type: "Selector", now: "MISSING" },
    }
    const result = buildDiagnosis({
      target: "www.example.com",
      rules,
      proxies: broken,
      connections: [conn],
      dnsResponse: { Status: 0 },
      dnsLogEvents: [],
    })
    expect(result.proxy.chain).toEqual({
      value: ["MEDIA", "PROXY", "node-local"],
      status: "observed",
      source: "connections-api",
    })
    expect(result.proxy.leafType.status).toBe("unavailable")
    expect(result.proxy.leafType.reason).toEqual({
      key: "proxy.leafUnavailable",
      params: { cause: { key: "chain.nodeMissing", params: { name: "MISSING" } } },
    })
    expect(result.notes.some((n) => n.key === "note.chainExpandFailed")).toBe(true)
  })

  it("labels the leaf as providers-api when the now target is a provider node", () => {
    const withProvider: Record<string, ProxyNode> = {
      ...proxies,
      PROXY: { name: "PROXY", type: "Selector", now: "sub-node" },
    }
    const result = buildDiagnosis({
      target: "www.example.com",
      rules,
      proxies: withProvider,
      providerProxies: { "sub-node": { name: "sub-node", type: "Vless" } },
      connections: [{ ...conn, chains: ["sub-node", "PROXY", "MEDIA"] }],
      dnsResponse: { Status: 0 },
      dnsLogEvents: [],
    })
    expect(result.proxy.chain).toEqual({
      value: ["MEDIA", "PROXY", "sub-node"],
      status: "observed",
      source: "proxies-api",
    })
    expect(result.proxy.leafType).toEqual({
      value: "Vless",
      status: "observed",
      source: "providers-api",
    })
  })

  it("prefers /proxies over /providers/proxies for the same name", () => {
    const result = buildDiagnosis({
      target: "www.example.com",
      rules,
      proxies,
      providerProxies: { "node-local": { name: "node-local", type: "Vless" } },
      connections: [conn],
      dnsResponse: { Status: 0 },
      dnsLogEvents: [],
    })
    expect(result.proxy.leafType).toEqual({
      value: "Socks5",
      status: "observed",
      source: "proxies-api",
    })
  })

  it("marks IP targets as having no DNS resolution", () => {
    const result = buildDiagnosis({
      target: "1.2.3.4",
      rules,
      proxies,
      connections: [],
      dnsResponse: null,
      dnsLogEvents: [],
    })
    expect(result.dns.answers.status).toBe("unavailable")
    expect(result.dns.answers.reason).toEqual({ key: "dns.ipTarget" })
  })
})
