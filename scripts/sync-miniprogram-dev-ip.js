/**
 * 启动后端前写入小程序 dev 的 API_BASE（本机局域网 IPv4 + 端口）。
 * 由 server 的 prestart / predev 调用；也可手动：在仓库根目录 `node scripts/sync-miniprogram-dev-ip.js`
 */
const fs = require('fs')
const path = require('path')
const os = require('os')

const ROOT = path.join(__dirname, '..')
const ENV_JS = path.join(ROOT, 'miniprogram', 'config', 'env.js')
const SERVER_ENV = path.join(ROOT, 'server', '.env')

/** 与 env.js 中 dev 段注释一致，用于定位 API_BASE */
const MARKER = 'SYNC_MINIPROGRAM_API'

function isIPv4(net) {
  const fam = net.family
  return fam === 'IPv4' || fam === 4
}

function pickLanIPv4() {
  const nets = os.networkInterfaces()
  const candidates = []
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (isIPv4(net) && !net.internal) {
        candidates.push(net.address)
      }
    }
  }
  function score(addr) {
    if (addr.startsWith('192.168.')) return 300
    if (addr.startsWith('10.')) return 200
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(addr)) return 250
    return 100
  }
  candidates.sort((a, b) => score(b) - score(a))
  return candidates[0] || '127.0.0.1'
}

function readServerPort() {
  if (process.env.PORT) {
    const p = parseInt(process.env.PORT, 10)
    if (!Number.isNaN(p) && p > 0) return p
  }
  try {
    const raw = fs.readFileSync(SERVER_ENV, 'utf8')
    const m = /^PORT\s*=\s*(\d+)/m.exec(raw)
    if (m) {
      const p = parseInt(m[1], 10)
      if (!Number.isNaN(p) && p > 0) return p
    }
  } catch (_) {}
  return 3000
}

function main() {
  let envJs
  try {
    envJs = fs.readFileSync(ENV_JS, 'utf8')
  } catch (e) {
    console.error('[sync-miniprogram-dev-ip] 读不到', ENV_JS, e.message)
    process.exit(1)
  }

  if (!envJs.includes(`// ${MARKER}`)) {
    console.warn('[sync-miniprogram-dev-ip] env.js 缺少', MARKER, '标记，跳过')
    return
  }

  const ip = pickLanIPv4()
  const port = readServerPort()
  const apiBase = `http://${ip}:${port}/api`

  const re = new RegExp(
    `(\\r?\\n\\s*\\/\\/ ${MARKER}[^\\r\\n]*\\r?\\n\\s*API_BASE:\\s*)'[^']*'`,
    'm'
  )
  if (envJs.search(re) < 0) {
    console.warn('[sync-miniprogram-dev-ip] 未找到可替换的 API_BASE，请检查 miniprogram/config/env.js 中 dev 段是否含', MARKER, '标记')
    process.exitCode = 1
    return
  }

  const next = envJs.replace(re, `$1'${apiBase}'`)
  if (next === envJs) {
    console.log('[sync-miniprogram-dev-ip] dev.API_BASE 已是', apiBase, '（无需写入）')
    return
  }

  fs.writeFileSync(ENV_JS, next, 'utf8')
  console.log('[sync-miniprogram-dev-ip] dev.API_BASE →', apiBase)
}

main()
