import { createClient, type Client, type Interceptor } from "@connectrpc/connect"
import { createGrpcWebTransport } from "@connectrpc/connect-web"

import { classifyTarget } from "../../diagnostics/diagnose"
import { StartedService, type Connection, type Group, type GroupItem } from "./started_lite_pb"

import type { ProxyNode } from "../../diagnostics/proxyChain"
import type { RawConnection } from "../client"

export interface SingboxConfig {
  /** For example http://127.0.0.1:19090 */
  baseUrl: string
  secret: string
}

/** Upper bound for one snapshot read, so an unreachable service fails instead of hanging */
const REQUEST_TIMEOUT_MS = 5000

/** Splits "host:port" and "[v6]:port"; the port is returned as text, matching Mihomo's destinationPort */
export function parseHostPort(value: string): { host: string; port: string } {
  const idx = value.lastIndexOf(":")
  if (idx < 0) return { host: value, port: "" }
  return { host: value.slice(0, idx).replace(/^\[(.*)\]$/, "$1"), port: value.slice(idx + 1) }
}

/** Maps a sing-box connection onto the Mihomo shape so the shared correlation logic can be reused */
export function toRawConnection(connection: Connection): RawConnection {
  const { host, port } = parseHostPort(connection.destination)
  const isIp = classifyTarget(host) === "ip"
  // sing-box rules look like "domain_suffix=localhost"; the final route has an empty rule
  const eq = connection.rule.indexOf("=")
  return {
    id: connection.id,
    metadata: {
      host: connection.domain || (isIp ? "" : host),
      destinationIP: isIp ? host : "",
      destinationPort: port,
      network: connection.network,
      sourceIP: parseHostPort(connection.source).host,
      dnsMode: "",
      type: connection.inboundType,
    },
    rule: eq < 0 ? connection.rule : connection.rule.slice(0, eq),
    rulePayload: eq < 0 ? "" : connection.rule.slice(eq + 1),
    chains: connection.chainList,
    start: new Date(Number(connection.createdAt)).toISOString(),
  }
}

/** Group entries override plain outbounds with the same tag, so a selector keeps its `now` */
export function toProxyNodes(outbounds: GroupItem[], groups: Group[]): Record<string, ProxyNode> {
  const nodes: Record<string, ProxyNode> = {}
  for (const outbound of outbounds) {
    nodes[outbound.tag] = { name: outbound.tag, type: outbound.type }
  }
  for (const group of groups) {
    nodes[group.tag] = {
      name: group.tag,
      type: group.type,
      now: group.selected,
      all: group.items.map((item) => item.tag),
    }
  }
  return nodes
}

/** Server-streaming RPCs send a snapshot first; reading it and returning cancels the stream */
async function firstMessage<T>(stream: AsyncIterable<T>): Promise<T> {
  for await (const message of stream) return message
  throw new Error("sing-box stream ended without a snapshot")
}

export class SingboxClient {
  private readonly rpc: Client<typeof StartedService>

  constructor(config: SingboxConfig) {
    const authorize: Interceptor = (next) => async (req) => {
      req.header.set("Authorization", `Bearer ${config.secret}`)
      return next(req)
    }
    const transport = createGrpcWebTransport({
      baseUrl: config.baseUrl.replace(/\/$/, ""),
      interceptors: [authorize],
    })
    this.rpc = createClient(StartedService, transport)
  }

  private options() {
    return { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }
  }

  /** Open connections only; the snapshot also contains connections that have already closed */
  async getConnections(): Promise<RawConnection[]> {
    const snapshot = await firstMessage(this.rpc.subscribeConnections({}, this.options()))
    return snapshot.events
      .map((event) => event.connection)
      .filter(
        (connection): connection is Connection =>
          connection !== undefined && connection.closedAt === 0n,
      )
      .map(toRawConnection)
  }

  async getProxies(): Promise<Record<string, ProxyNode>> {
    const [outbounds, groups] = await Promise.all([
      firstMessage(this.rpc.subscribeOutbounds({}, this.options())),
      firstMessage(this.rpc.subscribeGroups({}, this.options())),
    ])
    return toProxyNodes(outbounds.outbounds, groups.group)
  }

  /** Buffered log lines; each line still has ANSI color codes and the level prefix */
  async getLogLines(): Promise<string[]> {
    const log = await firstMessage(this.rpc.subscribeLog({}, this.options()))
    return log.messages.map((message) => message.message)
  }
}
