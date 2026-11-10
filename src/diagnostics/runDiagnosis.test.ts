import { describe, expect, it } from "vitest"

import { runDiagnosis } from "./diagnose"

import type { MihomoClient } from "../api/client"

/** Records kernel-facing calls in order; no network is involved */
function fakeClient() {
  const calls: string[] = []
  const client = {
    flushDnsCache: async () => {
      calls.push("flushDnsCache")
    },
    watchLogs: async () => () => {},
    queryDns: async () => {
      calls.push("queryDns")
      return { Status: 0 }
    },
    getRules: async () => [],
    getProxies: async () => ({}),
    getProviderProxies: async () => ({}),
    getConnections: async () => [],
  }
  return { client: client as unknown as MihomoClient, calls }
}

describe("runDiagnosis live upstream handling", () => {
  it("flushes the DNS cache before querying", async () => {
    const { client, calls } = fakeClient()
    await runDiagnosis(client, "example.com", { liveUpstream: true })
    expect(calls).toEqual(["flushDnsCache", "queryDns"])
  })

  it("does not touch the kernel cache when the option is off", async () => {
    const { client, calls } = fakeClient()
    await runDiagnosis(client, "example.com", { liveUpstream: false })
    expect(calls).toEqual(["queryDns"])
  })
})
