import type { Message } from "../i18n/messages"

export interface ProxyNode {
  name: string
  type: string
  now?: string
  all?: string[]
}

export type ChainResult =
  | {
      /** Full chain from the root group to the leaf node */
      chain: string[]
      leafType: string
    }
  | { error: Message }

/**
 * Recursively follows `now` through Selector/URLTest-style groups to build the full chain from root to leaf.
 * Missing nodes or cycles return an error with the reason; nothing is guessed.
 */
export function resolveProxyChain(proxies: Record<string, ProxyNode>, root: string): ChainResult {
  const chain: string[] = []
  const seen = new Set<string>()
  let current = root

  while (true) {
    const node = proxies[current]
    if (!node) return { error: { key: "chain.nodeMissing", params: { name: current } } }
    if (seen.has(current)) return { error: { key: "chain.loop", params: { name: current } } }
    seen.add(current)
    chain.push(current)
    if (node.now === undefined) {
      return { chain, leafType: node.type }
    }
    current = node.now
  }
}

/**
 * Connection data lists `chains` leaf-first, with the top group last. Reverse it to root-first before comparing.
 */
export function chainsMatchRootFirst(observedChains: string[], resolvedChain: string[]): boolean {
  const rootFirst = [...observedChains].reverse()
  return (
    rootFirst.length === resolvedChain.length && rootFirst.every((n, i) => n === resolvedChain[i])
  )
}
