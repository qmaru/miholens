import type { MessageKey } from "./i18n/messages"

export const DEFAULT_BASE_URL = "http://127.0.0.1:9090"
const STORAGE_KEY = "connections"

export type Backend = "mihomo" | "singbox"

export const BACKEND_LABEL: Record<Backend, MessageKey> = {
  mihomo: "backend.mihomo",
  singbox: "backend.singbox",
}

export interface Connection {
  id: string
  name: string
  backend: Backend
  baseUrl: string
  secret: string
}

export interface SavedConnections {
  connections: Connection[]
  activeId: string
  remember: boolean
}

function readJson<T>(key: string): T | null {
  const raw = localStorage.getItem(key)
  if (raw === null) {
    return null
  }
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function loadSavedConnections(defaultName: string): SavedConnections {
  const saved = readJson<Omit<SavedConnections, "remember">>(STORAGE_KEY)
  if (saved !== null) {
    return { ...saved, remember: true }
  }
  const connection: Connection = {
    id: "default",
    name: defaultName,
    backend: "mihomo",
    baseUrl: DEFAULT_BASE_URL,
    secret: "",
  }
  return { connections: [connection], activeId: connection.id, remember: false }
}

export function saveConnections(state: SavedConnections) {
  if (state.remember) {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ connections: state.connections, activeId: state.activeId }),
    )
  } else {
    localStorage.removeItem(STORAGE_KEY)
  }
}

export function connectionLabel(connection: Connection): string {
  return connection.name.trim() || connection.baseUrl
}
