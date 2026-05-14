'use strict'

/**
 * 自定义顶栏（navigationStyle: custom）安全区 + 胶囊高度
 * 与微信右上角胶囊垂直区域对齐，供多页复用。
 */
function getHeroInset() {
  const sys = wx.getSystemInfoSync()
  const sb = sys.statusBarHeight || 20
  const safeTop = sys.safeArea && sys.safeArea.top > 0 ? sys.safeArea.top : sb
  let insetTop = Math.max(sb, safeTop)
  let capsuleH = 32
  try {
    const m = wx.getMenuButtonBoundingClientRect()
    if (m && m.top > 0) insetTop = Math.max(insetTop, m.top)
    if (m && m.height > 0) capsuleH = m.height
  } catch (_) {}
  return { heroPaddingTop: insetTop, capsuleHeight: capsuleH }
}

module.exports = { getHeroInset }
