export type Lang = "en" | "zh"

/** A translatable message. `params` fill `{name}` placeholders; nested messages are translated too. */
export interface Message {
  key: MessageKey
  params?: Record<string, string | number | Message>
}

const en = {
  "common.noData": "No data",
  "common.noAnswer": "No answer",

  "theme.light": "Light",
  "theme.dark": "Dark",

  "connection.title": "Connection settings",
  "connection.summary": "{baseUrl} · Secret {state}",
  "connection.secretUnset": "not set",
  "connection.baseUrl": "API address",
  "connection.remember":
    "Remember connection settings (saved in this browser; Secret is stored in plain text)",

  "form.target": "Domain or IP",
  "form.diagnose": "Diagnose",
  "form.diagnosing": "Diagnosing…",
  "form.hint":
    "Diagnosis reads active connections. If the target has no connection, first access it once through the Mihomo proxy.",
  "form.liveUpstream":
    "Before querying DNS, flush the kernel DNS cache so the real upstream is captured from the debug log",

  "target.domain": "Domain",
  "target.ip": "IP",
  "result.title": "Diagnosis result",

  "status.observed": "Observed",
  "status.unavailable": "Unavailable",
  "status.not-run": "Not run",

  "section.dns": "DNS",
  "section.rules": "Rules",
  "section.proxy": "Proxy",
  "section.correlation": "Correlation",

  "highlight.upstream": "Actual DNS upstream",
  "highlight.kernelRule": "Kernel-matched rule",
  "highlight.rootGroup": "Root proxy group",

  "field.answers": "Resolved answers",
  "field.rcode": "Response code",
  "field.upstream": "Actual upstream",
  "field.kernelRule": "Kernel-matched rule",
  "field.rootGroup": "Root proxy group",
  "field.chain": "Full proxy chain",
  "field.leafType": "Leaf node type",
  "field.observedChain": "Chain from connection record",
  "field.probe": "Matched kernel connection",

  "error.http": "{path} request failed: HTTP {status}",
  "error.generic": "Request failed: {message}",

  "dns.ipTarget": "Target is an IP; no DNS resolution needed",
  "dns.noUpstreamLog":
    "No upstream captured in logs: the kernel may have returned a cached result (enable the live upstream option below the target field to flush the cache first)",
  "dns.logStreamFailed":
    "Log stream failed: the upstream could not be read from /logs (check the secret and the address)",
  "dns.fakeIpNote":
    "The /dns/query answer is the kernel's actual resolution result, but it does not show whether fake-ip mapping was applied",

  "rule.noConnection":
    "No connection for this target in /connections; first access the target through the proxy",
  "rule.notInRules": "Connection rule {rule} {payload} not found in /rules",
  "rule.emptyField": "The kernel connection record has an empty rule field",

  "connection.none": "No connection record for this target",

  "proxy.noRootGroup": "No proxy group available",
  "proxy.leafUnavailable": "{cause}, leaf node type unavailable",
  "proxy.chainFallbackUnavailable": "{cause}, and no connection record for this target",

  "note.chainExpandFailed":
    "Proxy chain expansion failed ({cause}); the full chain falls back to observations from the connection record",
  "note.chainMismatch":
    "The connection record's proxy chain differs from the current /proxies expansion (proxy group selection may have changed)",

  "chain.nodeMissing": 'Node "{name}" not found in /proxies or /providers/proxies',
  "chain.loop": 'Proxy group "{name}" has a cycle in its now chain',
}

export type MessageKey = keyof typeof en

const zh: Record<MessageKey, string> = {
  "common.noData": "无数据",
  "common.noAnswer": "无应答",

  "theme.light": "浅色",
  "theme.dark": "深色",

  "connection.title": "连接设置",
  "connection.summary": "{baseUrl} · Secret {state}",
  "connection.secretUnset": "未设置",
  "connection.baseUrl": "API 地址",
  "connection.remember": "记住连接设置（保存在本地浏览器，Secret 以明文存储）",

  "form.target": "域名或 IP",
  "form.diagnose": "诊断",
  "form.diagnosing": "诊断中…",
  "form.hint": "诊断读取的是当前活动连接。若目标没有连接，请先通过 Mihomo 代理访问一次目标。",
  "form.liveUpstream": "诊断前清空内核 DNS 缓存，以便从调试日志捕获真实上游",

  "target.domain": "域名",
  "target.ip": "IP",
  "result.title": "诊断结果",

  "status.observed": "内核实际",
  "status.unavailable": "无法获取",
  "status.not-run": "未执行",

  "section.dns": "DNS",
  "section.rules": "规则",
  "section.proxy": "代理",
  "section.correlation": "关联",

  "highlight.upstream": "实际 DNS 上游",
  "highlight.kernelRule": "内核命中规则",
  "highlight.rootGroup": "根代理组",

  "field.answers": "解析结果",
  "field.rcode": "应答码",
  "field.upstream": "实际上游",
  "field.kernelRule": "内核命中规则",
  "field.rootGroup": "根代理组",
  "field.chain": "完整代理链",
  "field.leafType": "叶子节点类型",
  "field.observedChain": "连接记录代理链",
  "field.probe": "匹配的内核连接",

  "error.http": "{path} 请求失败：HTTP {status}",
  "error.generic": "请求失败：{message}",

  "dns.ipTarget": "目标为 IP，无需 DNS 解析",
  "dns.noUpstreamLog":
    "未捕获到上游日志：内核可能返回了缓存结果（请开启输入框下方的实时上游选项，先清空缓存）",
  "dns.logStreamFailed": "日志连接失败：无法从 /logs 读取上游，请检查密钥和地址",
  "dns.fakeIpNote": "/dns/query 的应答为内核实际解析结果，但不说明其是否经过 fake-ip 映射",

  "rule.noConnection": "/connections 中没有该目标的连接，需先通过代理访问一次目标",
  "rule.notInRules": "连接记录的规则 {rule} {payload} 在 /rules 中未找到",
  "rule.emptyField": "内核连接记录的规则字段为空",

  "connection.none": "没有该目标的连接记录",

  "proxy.noRootGroup": "没有可用的代理组",
  "proxy.leafUnavailable": "{cause}，无法获取叶子节点类型",
  "proxy.chainFallbackUnavailable": "{cause}，且没有该目标的连接记录",

  "note.chainExpandFailed": "代理链展开失败（{cause}），完整代理链改用连接记录中的观察结果",
  "note.chainMismatch": "连接记录的代理链与 /proxies 当前展开结果不一致（代理组选择可能已变化）",

  "chain.nodeMissing": '节点 "{name}" 在 /proxies 与 /providers/proxies 中均不存在',
  "chain.loop": '代理组 "{name}" 的 now 链路存在循环',
}

const catalogs: Record<Lang, Record<MessageKey, string>> = { en, zh }

export function translate(message: Message, lang: Lang): string {
  return catalogs[lang][message.key].replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = message.params?.[name]
    if (value === undefined) {
      return ""
    }
    return typeof value === "object" ? translate(value, lang) : String(value)
  })
}

/** The text for one key in every language, so a control can reserve room for all of them */
export function translationsOf(key: MessageKey): string[] {
  return Object.values(catalogs).map((catalog) => catalog[key])
}
