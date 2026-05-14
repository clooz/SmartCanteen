const api = require('../../utils/api')
const { syncTabBarSelected } = require('../../utils/tab-bar')
const { getToken } = require('../../utils/storage')

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

function formatZhMenuDate(input) {
  let d
  if (!input) {
    d = new Date()
  } else if (input instanceof Date) {
    d = input
  } else {
    const s = String(input).slice(0, 10)
    d = new Date(s.replace(/-/g, '/'))
  }
  if (Number.isNaN(d.getTime())) return ''
  const weeks = ['日', '一', '二', '三', '四', '五', '六']
  return `${d.getMonth() + 1}月${d.getDate()}日 · 星期${weeks[d.getDay()]}`
}

Page({
  data: {
    loading: false,
    hasMenu: false,
    breakfastDishes: [],
    lunchDishes: [],
    menuDateLine: formatZhMenuDate(),
    totalDishCount: 0,
    breakfastExpanded: true,
    lunchExpanded: true,
  },

  onShow() {
    syncTabBarSelected()
    this.checkLoginAndLoad()
    this.startAutoRefresh()
  },

  onHide() {
    this.stopAutoRefresh()
  },

  onUnload() {
    this.stopAutoRefresh()
  },

  onPullDownRefresh() {
    this.loadMenu().finally(() => wx.stopPullDownRefresh())
  },

  checkLoginAndLoad() {
    if (!getToken()) {
      this.stopAutoRefresh()
      wx.reLaunch({ url: '/pages/login/login' })
      return
    }
    this.loadMenu()
  },

  startAutoRefresh() {
    this.stopAutoRefresh()
    this.refreshTimer = setInterval(() => {
      if (getToken()) {
        this.loadMenu({ silent: true })
      }
    }, 15000)
  },

  stopAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer)
      this.refreshTimer = null
    }
  },

  async loadMenu(options = {}) {
    const { silent = false, manual = false } = options
    const refreshStartedAt = Date.now()
    if (!silent) this.setData({ loading: true })
    if (manual) {
      wx.showLoading({ title: '刷新中...', mask: false })
    }
    try {
      const res = await api.getTodayMenu({ _t: Date.now() })
      const menu = res.data
      if (!menu) {
        this.setData({
          hasMenu: false,
          breakfastDishes: [],
          lunchDishes: [],
          menuDateLine: formatZhMenuDate(),
          totalDishCount: 0,
        })
        if (manual) {
          wx.showToast({ title: '已刷新，暂无菜单', icon: 'none', duration: 1200 })
        }
        return
      }

      // 后端返回 dishes 平铺数组，按 meal_type 分组
      const allDishes = menu.dishes || []
      const normalize = d => ({
        ...d,
        image_url: api.resolveAssetUrl(d.image_url),
      })
      const breakfastDishes = allDishes.filter(d => d.meal_type === 'breakfast').map(normalize)
      const lunchDishes     = allDishes.filter(d => d.meal_type === 'lunch').map(normalize)

      const hasMenu = breakfastDishes.length > 0 || lunchDishes.length > 0
      const totalDishCount = breakfastDishes.length + lunchDishes.length
      this.setData({
        hasMenu,
        breakfastDishes,
        lunchDishes,
        menuDateLine: formatZhMenuDate(menu.menu_date),
        totalDishCount,
      })
      if (manual) {
        wx.showToast({ title: '已刷新', icon: 'success', duration: 900 })
      }
    } catch {
      this.setData({ hasMenu: false, menuDateLine: formatZhMenuDate(), totalDishCount: 0 })
    } finally {
      if (manual) {
        const remain = 600 - (Date.now() - refreshStartedAt)
        if (remain > 0) await sleep(remain)
      }
      if (!silent) this.setData({ loading: false })
      if (manual) {
        wx.hideLoading()
      }
    }
  },

  onRefresh() {
    if (this._manualRefreshBusy || this.data.loading) return
    this._manualRefreshBusy = true
    this.loadMenu({ manual: true, silent: this.data.hasMenu }).finally(() => {
      this._manualRefreshBusy = false
    })
  },

  goOrder() {
    wx.navigateTo({ url: '/pages/order/order' })
  },

  goWish() {
    wx.switchTab({ url: '/pages/wish/wish' })
  },

  goProfile() {
    wx.switchTab({ url: '/pages/profile/profile' })
  },

  onToggleMeal(e) {
    const meal = e.currentTarget.dataset.meal
    if (meal === 'breakfast') {
      this.setData({ breakfastExpanded: !this.data.breakfastExpanded })
    } else if (meal === 'lunch') {
      this.setData({ lunchExpanded: !this.data.lunchExpanded })
    }
  },
})
