'use strict'

/** 同步自定义 tabBar 选中态（仅在 tab 页 onShow 中调用） */
function syncTabBarSelected() {
  const pages = getCurrentPages()
  const page = pages[pages.length - 1]
  if (!page || typeof page.getTabBar !== 'function') return
  const tab = page.getTabBar()
  if (tab && typeof tab.syncSelected === 'function') tab.syncSelected()
}

module.exports = { syncTabBarSelected }
