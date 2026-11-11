# AGENTS.md

## Project

miholens (Mihomo Inspector) is a pure-frontend diagnostic tool. Given a domain or IP, it shows how Mihomo handles it across DNS, rules, and proxies. Stack: React, TypeScript, Astro (static host), Tailwind CSS v4.

## Constraints

- Call the Mihomo REST API and WebSocket directly. No backend.
- sing-box is read through its native gRPC API (`daemon.StartedService`, via `@connectrpc/connect-web`) directly from the browser. It has no rule list, DNS query, DNS flush, or log-level RPC, so those fields are unavailable in sing-box mode and DNS comes from the buffered log stream only.
- Offline-first: `public/sw.js` precaches the built shell (cache-first). Mihomo API responses are never cached. When online, the worker only checks for updates; activation is user-triggered via the banner.
- Do not modify Mihomo. No config or proxy management, except the opt-in live-upstream switch. For one diagnosis it flushes the DNS cache (POST /cache/dns/flush), then reads the upstream from the `/logs?level=debug` stream. The kernel log-level is not changed, and nothing is written to the config file.
- No local rule simulation. Show only live kernel state.
- Never guess. Mark data the API cannot provide as unavailable, with the reason.
- The dev server must stay on http://localhost:4321/ while the user is watching.

## Commands

- `pnpm dev`: dev server (Astro, port 4321)
- `pnpm build`: static build
- `pnpm test`: vitest
- `pnpm fmt`: format with oxfmt
- `pnpm lint`: lint with oxlint

Run `pnpm fmt`, `pnpm lint`, and `pnpm test` before finishing a change. There is no typecheck script.

## Layout

- `src/api/`: Mihomo REST and WebSocket client
- `src/diagnostics/`: data model, DNS log parsing, proxy chain, correlation
- `src/components/`: switches and shared UI pieces
- `src/i18n/`: message catalogs (en and zh) and the language provider
- `src/styles.css`: theme tokens
- `src/pages/index.astro`: page shell, favicon, theme script
- `public/sw.js`: offline service worker; build manifest injected by `serviceWorker()` in `astro.config.mjs`
- `src/serviceWorker.ts`: registration and update hook (production only)
- `src/api/singbox/`: sing-box gRPC client; `started_lite_pb.ts` is generated code, do not hand-edit
- `src/diagnostics/singboxDiagnose.ts`, `singboxDnsLog.ts`: sing-box diagnosis and DNS log parsing

## Conventions

- Code comments are in English, and only where they clarify something non-obvious.
- Chinese text lives only in the zh catalog in `src/i18n/messages.ts`. Components use `t()` or `tm()`.
- Keep the theme surfaces distinct: page < surface < inset.
- Use monospace only for raw technical values: the diagnosed target, DNS answers, and `Code` chips. Use sans for labels and summaries.
- Give a background only to fixed content such as status tags and section containers, not to returned values.
- Use `StableLabel` for toggles and buttons whose text changes, so their width does not shift.
- Prefer `rotate-*` over `transform` in Tailwind.
- Keep changes small and reuse existing patterns. Avoid speculative helpers and defensive code.
- Verify UI changes in the browser at http://localhost:4321/, in both light and dark themes and in both languages.
