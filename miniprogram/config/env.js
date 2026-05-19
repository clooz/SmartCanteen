/**
 * 小程序环境：改 `CURRENT` 为 `dev` | `staging` | `production` 即可切换整套 API。
 * dev 下 API_BASE：在 server 目录执行 `npm run dev` / `npm start` 时会先运行脚本，自动写入本机局域网 IPv4（与手机同 WiFi 可调接口）。
 * 仅改端口时：设置环境变量 PORT 或在 server/.env 里写 PORT=xxxx；也可手动执行 `node scripts/sync-miniprogram-dev-ip.js`。
 *
 * 真机图片不显示时优先检查：① API_BASE 不能是 localhost/127.0.0.1（真机上的本机是手机自己）；
 * ② 手机与电脑同一局域网；③ 电脑防火墙放行端口；④ 开发者工具「详情」→「本地设置」勾选不校验合法域名（含图片下载）；
 * ⑤ 正式/体验版上线需在公众平台配置 request 与 downloadFile 合法域名且一般为 HTTPS。
 */
const CURRENT = 'dev'

const PRESETS = {
  dev: {
    // SYNC_MINIPROGRAM_API（由 scripts/sync-miniprogram-dev-ip.js 自动更新，勿改本行标记）
    API_BASE: 'http://172.16.0.166:3000/api',
  },
  staging: {
    API_BASE: 'https://your-staging-host.example.com/api',
  },
  production: {
    API_BASE: 'https://your-api-host.example.com/api',
  },
}

module.exports = PRESETS[CURRENT] || PRESETS.dev
