import { describe, expect, it } from "vitest"

import { parseSingboxDnsLogs } from "./singboxDnsLog"

const PASTED = [
  "INFO[96892] dns: refreshed A d2h67oheeuigaw.cloudfront.net. 60 IN A 65.9.180.10",
  "INFO[96894] [2023573158 0ms] inbound/tun[tun-in]: inbound DNS packet connection from 192.168.46.2:57554",
  "DEBUG[96894] [2023573158 0ms] dns: exchange code.toho373.com. IN A",
  "INFO[96894] [2532434159 0ms] inbound/tun[tun-in]: inbound DNS packet connection from 192.168.46.2:57936",
  "DEBUG[96894] [2532434159 0ms] dns: exchange code.toho373.com. IN HTTPS",
  "DEBUG[96894] [2023573158 0ms] dns: match[11] rule_set=[user-direct user-self user-steam-cn geosite-bilibili geosite-microsoft@cn geosite-microsoft-dev@cn] => route(china-dns)",
  "DEBUG[96894] [2023573158 0ms] dns: cached code.toho373.com NOERROR 277",
  "INFO[96894] [2023573158 0ms] dns: cached A code.toho373.com. 277 IN A 45.40.244.78",
  "DEBUG[96894] [2532434159 0ms] dns: match[11] rule_set=[user-direct user-self user-steam-cn geosite-bilibili geosite-microsoft@cn geosite-microsoft-dev@cn] => route(china-dns)",
  "DEBUG[96894] [2532434159 0ms] dns: cached code.toho373.com NOERROR 277",
  'INFO[96894] [2532434159 0ms] dns: cached HTTPS code.toho373.com. 277 IN HTTPS 1 . alpn="h3,h2" port="443" ipv4hint="45.40.244.78" ech="AEL+DQA+NQAgACAhZa4ThSefkGduBU4A5t8sW7DgFpBSIFlDZ8eBYmvPQgAEAAEAAQAPd3d3LnRvaG8zNzMuY29tAAA="',
  "INFO[96902] [1955560097 0ms] inbound/tun[tun-in]: inbound DNS packet connection from 192.168.46.2:40717",
  "DEBUG[96902] [1955560097 0ms] dns: exchange download.docker.com. IN A",
  "DEBUG[96902] [1955560097 0ms] dns: match[12] rule_set=[geosite-google geosite-geolocation-!cn geosite-tld-!cn geosite-microsoft geosite-microsoft-dev geosite-microsoft-pki user-apple-proxy user-proxy] => route(global-dns)",
  "DEBUG[96902] [1955560097 0ms] dns: cached download.docker.com NOERROR 49",
  "INFO[96902] [1955560097 0ms] dns: cached CNAME download.docker.com. 49 IN CNAME d2h67oheeuigaw.cloudfront.net.",
  "INFO[96902] [1955560097 0ms] dns: cached A d2h67oheeuigaw.cloudfront.net. 49 IN A 65.9.180.10",
  "INFO[96902] [1955560097 0ms] dns: cached A d2h67oheeuigaw.cloudfront.net. 49 IN A 65.9.180.126",
  "INFO[96902] [1955560097 0ms] dns: cached A d2h67oheeuigaw.cloudfront.net. 49 IN A 65.9.180.92",
  "INFO[96902] [1955560097 0ms] dns: cached A d2h67oheeuigaw.cloudfront.net. 49 IN A 65.9.180.34",
  "INFO[96902] [1955560097 0ms] dns: cached OPT OPT PSEUDOSECTION: EDNS: version 0 flags: udp: 512",
]

describe("parseSingboxDnsLogs", () => {
  it("reads the A answer, rcode and DNS server tag for a domain", () => {
    expect(parseSingboxDnsLogs(PASTED, "code.toho373.com")).toEqual({
      answers: [{ type: "A", data: "45.40.244.78", ttl: 277 }],
      rcode: 0,
      upstream: "china-dns",
    })
  })

  it("keeps CNAME and every A record, and skips the OPT pseudo-section", () => {
    const result = parseSingboxDnsLogs(PASTED, "download.docker.com")
    expect(result?.answers.map((a) => a.type)).toEqual(["CNAME", "A", "A", "A", "A"])
    expect(result?.answers[0]).toEqual({
      type: "CNAME",
      data: "d2h67oheeuigaw.cloudfront.net.",
      ttl: 49,
    })
    expect(result?.upstream).toBe("global-dns")
  })

  it("returns null when no A query for the target is in the lines", () => {
    expect(parseSingboxDnsLogs(PASTED, "example.org")).toBeNull()
  })

  it("matches the target case-insensitively", () => {
    expect(parseSingboxDnsLogs(PASTED, "CODE.toho373.com")?.upstream).toBe("china-dns")
  })

  it("strips ANSI color codes before parsing", () => {
    const colored = [
      "\u001b[36mDEBUG\u001b[0m[0001] [7 0ms] dns: exchange example.com. IN A",
      "\u001b[36mDEBUG\u001b[0m[0001] [7 0ms] dns: cached example.com NXDOMAIN 30",
    ]
    expect(parseSingboxDnsLogs(colored, "example.com")).toEqual({
      answers: [],
      rcode: 3,
      upstream: null,
    })
  })

  it("parses the lookup/exchanged format from sing-box 1.14", () => {
    const lab = [
      "DEBUG[0011] [2154835642 249ms] dns: lookup domain example.com",
      "DEBUG[0011] [2154835642 249ms] dns: exchanged example.com NOERROR 0",
      "DEBUG[0011] [2154835642 249ms] dns: exchanged example.com NOERROR 300",
      "INFO[0011] [2154835642 249ms] dns: exchanged A example.com. 300 IN A 1.2.3.4",
      "INFO[0011] [2154835642 249ms] dns: lookup succeed for example.com: ip ip",
    ]
    expect(parseSingboxDnsLogs(lab, "example.com")).toEqual({
      answers: [{ type: "A", data: "1.2.3.4", ttl: 300 }],
      rcode: 0,
      upstream: null,
    })
  })

  it("uses the latest query when the same domain is looked up twice", () => {
    const lines = [
      "DEBUG[1] [1 0ms] dns: lookup domain example.com",
      "DEBUG[1] [1 0ms] dns: exchanged example.com NXDOMAIN 30",
      "DEBUG[2] [2 0ms] dns: lookup domain example.com",
      "DEBUG[2] [2 0ms] dns: cached example.com NOERROR 299",
      "INFO[2] [2 0ms] dns: cached A example.com. 299 IN A 1.2.3.4",
    ]
    expect(parseSingboxDnsLogs(lines, "example.com")).toEqual({
      answers: [{ type: "A", data: "1.2.3.4", ttl: 299 }],
      rcode: 0,
      upstream: null,
    })
  })

  it("leaves rcode and upstream null when only info-level lines are present", () => {
    const infoOnly = [
      "DEBUG[1] [9 0ms] dns: exchange example.com. IN A",
      "INFO[1] [9 0ms] dns: cached A example.com. 60 IN A 1.2.3.4",
    ]
    expect(parseSingboxDnsLogs(infoOnly, "example.com")).toEqual({
      answers: [{ type: "A", data: "1.2.3.4", ttl: 60 }],
      rcode: null,
      upstream: null,
    })
  })
})
