import { create } from "@bufbuild/protobuf"
import { describe, expect, it } from "vitest"

import { parseHostPort, toProxyNodes, toRawConnection } from "./client"
import { ConnectionSchema, GroupItemSchema, GroupSchema } from "./started_lite_pb"

describe("parseHostPort", () => {
  it("splits host and port", () => {
    expect(parseHostPort("example.com:443")).toEqual({ host: "example.com", port: "443" })
  })

  it("strips brackets from IPv6 literals", () => {
    expect(parseHostPort("[2001:db8::1]:443")).toEqual({ host: "2001:db8::1", port: "443" })
  })
})

describe("toRawConnection", () => {
  it("maps a domain connection with a rule", () => {
    const connection = create(ConnectionSchema, {
      id: "c1",
      inboundType: "tun",
      network: "tcp",
      source: "192.168.46.2:57554",
      destination: "example.com:443",
      rule: "domain_suffix=example.com",
      outbound: "proxy",
      chainList: ["proxy", "select"],
      createdAt: 1700000000000n,
    })
    expect(toRawConnection(connection)).toEqual({
      id: "c1",
      metadata: {
        host: "example.com",
        destinationIP: "",
        destinationPort: "443",
        network: "tcp",
        sourceIP: "192.168.46.2",
        dnsMode: "",
        type: "tun",
      },
      rule: "domain_suffix",
      rulePayload: "example.com",
      chains: ["proxy", "select"],
      start: new Date(1700000000000).toISOString(),
    })
  })

  it("maps an IP destination to destinationIP and leaves host empty", () => {
    const connection = create(ConnectionSchema, {
      destination: "1.1.1.1:80",
      chainList: ["direct"],
    })
    const raw = toRawConnection(connection)
    expect(raw.metadata.destinationIP).toBe("1.1.1.1")
    expect(raw.metadata.host).toBe("")
  })

  it("maps the final route, which has an empty rule", () => {
    const raw = toRawConnection(create(ConnectionSchema, { rule: "", chainList: ["direct"] }))
    expect(raw.rule).toBe("")
    expect(raw.rulePayload).toBe("")
  })

  it("keeps the sniffed domain when present", () => {
    const raw = toRawConnection(
      create(ConnectionSchema, { domain: "a.com", destination: "1.1.1.1:443" }),
    )
    expect(raw.metadata.host).toBe("a.com")
  })
})

describe("toProxyNodes", () => {
  it("lets group state override the outbound entry with the same tag", () => {
    const outbounds = [
      create(GroupItemSchema, { tag: "select", type: "selector" }),
      create(GroupItemSchema, { tag: "proxy", type: "vless" }),
    ]
    const groups = [
      create(GroupSchema, {
        tag: "select",
        type: "selector",
        selected: "proxy",
        items: [create(GroupItemSchema, { tag: "proxy", type: "vless" })],
      }),
    ]
    expect(toProxyNodes(outbounds, groups)).toEqual({
      select: { name: "select", type: "selector", now: "proxy", all: ["proxy"] },
      proxy: { name: "proxy", type: "vless" },
    })
  })
})
