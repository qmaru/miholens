import react from "@astrojs/react"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "astro/config"
import { createHash } from "node:crypto"
import { readdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

/**
 * @param {string} root
 * @param {string} [prefix]
 * @returns {Promise<string[]>}
 */
async function listFiles(root, prefix = "") {
  const entries = await readdir(path.join(root, prefix), { withFileTypes: true })
  /** @type {string[]} */
  const files = []
  for (const entry of entries) {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      files.push(...(await listFiles(root, name)))
    } else {
      files.push(name)
    }
  }
  return files
}

function serviceWorker() {
  return {
    name: "service-worker",
    hooks: {
      /** @param {{ dir: URL }} options */
      "astro:build:done": async ({ dir }) => {
        const root = fileURLToPath(dir)
        const files = (await listFiles(root)).filter((file) => file !== "sw.js").sort()
        const hash = createHash("sha256")
        /** @type {string[]} */
        const urls = []
        for (const file of files) {
          hash.update(file).update(await readFile(path.join(root, file)))
          urls.push(file === "index.html" ? "/" : `/${file}`)
        }
        const build = { id: hash.digest("hex").slice(0, 12), urls }
        const html = await readFile(path.join(root, "index.html"), "utf8")
        const stylesheet = html
          .match(/href="(https:\/\/fonts\.googleapis\.com\/[^"]+)"/)[1]
          .replaceAll("&amp;", "&")
        const fonts = {
          stylesheet,
          cache: `miholens-fonts-${createHash("sha256").update(stylesheet).digest("hex").slice(0, 12)}`,
        }
        const swPath = path.join(root, "sw.js")
        const source = await readFile(swPath, "utf8")
        await writeFile(
          swPath,
          source
            .replace("__BUILD__", () => JSON.stringify(build))
            .replace("__FONTS__", () => JSON.stringify(fonts)),
        )
      },
    },
  }
}

export default defineConfig({
  integrations: [react(), serviceWorker()],
  vite: {
    plugins: [tailwindcss()],
  },
})
