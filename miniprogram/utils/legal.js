/** 与后端 LEGAL_VERSION 环境变量保持一致；升级协议时同步改大 */
const LEGAL_VERSION = '1'

/** @param {string} agreedVersion 本地已同意的版本 @param {string} [requiredVersion] 服务端要求的版本 */
function needsConsent(agreedVersion, requiredVersion) {
  const req = String(requiredVersion || LEGAL_VERSION).trim()
  const a = String(agreedVersion || '').trim()
  if (!a) return true
  return a !== req
}

module.exports = { LEGAL_VERSION, needsConsent }
