export type Lang = "en" | "zh"

/** A translatable message. `params` fill `{name}` placeholders; nested messages are translated too. */
export interface Message {
  key: MessageKey
  params?: Record<string, string | number | Message>
}

const en = {
  "common.noData": "No data",
  "common.noAnswer": "No answer",

  "theme.label": "Dark mode",
  "theme.light": "Light",
  "theme.dark": "Dark",
  "language.label": "Language",

  "connection.title": "Connection",
  "connection.defaultName": "Connection {index}",
  "connection.name": "Name",
  "connection.add": "Add",
  "connection.delete": "Delete",
  "connection.confirmDelete": "Confirm delete",
  "connection.secret": "Secret",
  "connection.secretUnset": "not set",
  "connection.baseUrl": "API address",
  "connection.remember": "Remember (Secret stored in plain text)",
  "connection.current": "Current",
  "connection.setActive": "Set as current",
  "connection.test": "Test",
  "connection.testing": "Testing…",
  "connection.testReachable": "Reachable",
  "connection.testFailed": "Failed",
  "connection.show": "Show",
  "connection.hide": "Hide",
  "connection.close": "Close",
  "connection.manage": "Manage connections…",

  "form.target": "Domain or IP",
  "form.diagnose": "Diagnose",
  "form.diagnosing": "Diagnosing…",
  "form.liveUpstream": "Flush DNS cache first",

  "target.domain": "Domain",
  "target.ip": "IP",
  "result.title": "Result",
  "tabs.trace": "Trace",
  "tabs.result": "Result",

  "trace.flush": "Flushing kernel DNS cache",
  "trace.dnsQuery": "Querying kernel DNS for {target}",
  "trace.dnsAnswer": "Kernel answered with {count} record(s), rcode {rcode}",
  "trace.dnsLogs": "Collected {count} DNS log line(s)",
  "trace.loaded": "Read {rules} rules, {proxies} proxies, {connections} connections",
  "trace.singboxLoaded": "Read {proxies} proxies, {connections} connections",
  "trace.singboxLogs": "Read {count} sing-box log line(s)",
  "trace.rule": "Matched {type},{payload} → {proxy}",
  "trace.noRule": "Matched rule not observed",
  "trace.chain": "Chain {chain}",
  "trace.noChain": "Proxy chain not observed",
  "trace.probe": "Live connection {id} matched",
  "trace.noProbe": "No live connection for this target",
  "phase.running": "Running",
  "phase.done": "Done",
  "phase.failed": "Failed",

  "status.observed": "Observed",
  "status.unavailable": "Unavailable",
  "status.not-run": "Not run",

  "section.dns": "DNS",
  "section.rules": "Rules",
  "section.proxy": "Proxy",
  "section.correlation": "Correlation",

  "highlight.upstream": "DNS upstream",
  "highlight.kernelRule": "Kernel-matched rule",
  "highlight.rootGroup": "Root proxy group",

  "field.answers": "Answers",
  "field.rcode": "Response code",
  "field.upstream": "Upstream",
  "field.kernelRule": "Kernel-matched rule",
  "field.rootGroup": "Root proxy group",
  "field.chain": "Proxy chain",
  "field.leafType": "Leaf node type",
  "field.observedChain": "Connection chain",
  "field.probe": "Matched connection",

  "error.http": "{path} request failed: HTTP {status}",
  "error.generic": "Request failed: {message}",

  "update.ready": "New version ready",
  "update.apply": "Refresh to update",

  "backend.label": "Backend",
  "backend.mihomo": "mihomo",
  "backend.singbox": "sing-box",
  "dns.noQueryLog": "No DNS query for this target in the log buffer",
  "dns.noLogLine": "Not in the log buffer",
  "dns.singboxLogNote": "From sing-box log buffer; upstream is a DNS server tag.",
  "rule.singboxFinal": "No rule matched; used the final route",

  "dns.ipTarget": "Target is an IP; no DNS resolution needed",
  "dns.noUpstreamLog": "No upstream in logs; likely cached. Flush DNS cache and retry.",
  "dns.logStreamFailed": "Log stream failed; check the secret and address",
  "dns.fakeIpNote": "Kernel result; fake-ip mapping not shown",

  "rule.noConnection": "No connection; access the target through the proxy first",
  "rule.notInRules": "Kernel matched {rule} {payload}, but /rules has no matching entry",
  "rule.emptyField": "The kernel connection record has an empty rule field",

  "connection.none": "No connection record for this target",

  "proxy.noRootGroup": "No proxy group available",
  "proxy.leafUnavailable": "{cause}, leaf node type unavailable",
  "proxy.chainFallbackUnavailable": "{cause}, and no connection record for this target",

  "note.chainExpandFailed": "Chain expansion failed ({cause}); using the connection record instead",
  "note.chainMismatch": "Connection record differs from /proxies",

  "chain.nodeMissing": 'Node "{name}" not found in /proxies or /providers/proxies',
  "chain.loop": 'Proxy group "{name}" has a cycle in its now chain',
}

export type MessageKey = keyof typeof en

const zh: Record<MessageKey, string> = {
  "common.noData": "无数据",
  "common.noAnswer": "无应答",

  "theme.label": "深色模式",
  "theme.light": "浅色",
  "theme.dark": "深色",
  "language.label": "语言",

  "connection.title": "连接",
  "connection.defaultName": "连接 {index}",
  "connection.name": "名称",
  "connection.add": "新增",
  "connection.delete": "删除",
  "connection.confirmDelete": "确认删除",
  "connection.secret": "密钥",
  "connection.secretUnset": "未设置",
  "connection.baseUrl": "API 地址",
  "connection.remember": "记住（Secret 明文存储）",
  "connection.current": "当前",
  "connection.setActive": "设为当前",
  "connection.test": "测试",
  "connection.testing": "测试中…",
  "connection.testReachable": "可连通",
  "connection.testFailed": "失败",
  "connection.show": "显示",
  "connection.hide": "隐藏",
  "connection.close": "关闭",
  "connection.manage": "管理连接…",

  "form.target": "域名或 IP",
  "form.diagnose": "诊断",
  "form.diagnosing": "诊断中…",
  "form.liveUpstream": "诊断前清空 DNS 缓存",

  "target.domain": "域名",
  "target.ip": "IP",
  "result.title": "结果",
  "tabs.trace": "过程",
  "tabs.result": "结果",

  "trace.flush": "清空内核 DNS 缓存",
  "trace.dnsQuery": "向内核查询 {target} 的 DNS",
  "trace.dnsAnswer": "内核返回 {count} 条记录，rcode {rcode}",
  "trace.dnsLogs": "收集到 {count} 条 DNS 日志",
  "trace.loaded": "读取到 {rules} 条规则、{proxies} 个代理、{connections} 个连接",
  "trace.singboxLoaded": "读取到 {proxies} 个代理、{connections} 个连接",
  "trace.singboxLogs": "读取到 {count} 条 sing-box 日志",
  "trace.rule": "命中 {type},{payload} → {proxy}",
  "trace.noRule": "未观测到命中的规则",
  "trace.chain": "代理链 {chain}",
  "trace.noChain": "未观测到代理链",
  "trace.probe": "匹配到实时连接 {id}",
  "trace.noProbe": "未找到该目标的实时连接",
  "phase.running": "运行中",
  "phase.done": "完成",
  "phase.failed": "失败",

  "status.observed": "内核实际",
  "status.unavailable": "无法获取",
  "status.not-run": "未执行",

  "section.dns": "DNS",
  "section.rules": "规则",
  "section.proxy": "代理",
  "section.correlation": "关联",

  "highlight.upstream": "DNS 上游",
  "highlight.kernelRule": "内核命中规则",
  "highlight.rootGroup": "根代理组",

  "field.answers": "解析结果",
  "field.rcode": "应答码",
  "field.upstream": "上游",
  "field.kernelRule": "内核命中规则",
  "field.rootGroup": "根代理组",
  "field.chain": "代理链",
  "field.leafType": "叶子节点类型",
  "field.observedChain": "连接代理链",
  "field.probe": "匹配的连接",

  "error.http": "{path} 请求失败：HTTP {status}",
  "error.generic": "请求失败：{message}",

  "update.ready": "新版本已就绪",
  "update.apply": "刷新以更新",

  "backend.label": "后端",
  "backend.mihomo": "mihomo",
  "backend.singbox": "sing-box",
  "dns.noQueryLog": "日志缓冲中没有该目标的 DNS 查询",
  "dns.noLogLine": "日志缓冲中没有该行",
  "dns.singboxLogNote": "来自 sing-box 日志缓冲；上游为 DNS 服务器标签。",
  "rule.singboxFinal": "未命中规则，走最终路由",

  "dns.ipTarget": "目标为 IP，无需 DNS 解析",
  "dns.noUpstreamLog": "日志中没有上游，可能命中缓存。清空 DNS 缓存后重试。",
  "dns.logStreamFailed": "日志流失败，请检查 Secret 和地址",
  "dns.fakeIpNote": "内核解析结果，不显示 fake-ip 映射",

  "rule.noConnection": "没有连接，请先通过代理访问目标",
  "rule.notInRules": "内核命中 {rule} {payload}，但 /rules 中没有对应条目",
  "rule.emptyField": "内核连接记录的规则字段为空",

  "connection.none": "没有该目标的连接记录",

  "proxy.noRootGroup": "没有可用的代理组",
  "proxy.leafUnavailable": "{cause}，无法获取叶子节点类型",
  "proxy.chainFallbackUnavailable": "{cause}，且没有该目标的连接记录",

  "note.chainExpandFailed": "代理链展开失败（{cause}），改用连接记录",
  "note.chainMismatch": "连接记录与 /proxies 不一致",

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
