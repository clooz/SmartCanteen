const api = require('../../utils/api')
const { getToken } = require('../../utils/storage')

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

Page({
  data: {
    loading: false,
    refreshing: false,
    hasMenu: false,
    breakfastDishes: [],
    lunchDishes: [],
    todayStr: '',
  },

  onLoad() {
    this.setTodayStr()
  },

  onShow() {
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

  setTodayStr() {
    const d = new Date()
    const week = ['日', '一', '二', '三', '四', '五', '六']
    const str = `${d.getMonth() + 1}月${d.getDate()}日 周${week[d.getDay()]}`
    this.setData({ todayStr: str })
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
      this.setData({ refreshing: true })
      wx.showLoading({ title: '刷新中...', mask: false })
    }
    try {
      const res = await api.getTodayMenu({ _t: Date.now() })
      const menu = res.data
      if (!menu) {
        this.setData({ hasMenu: false, breakfastDishes: [], lunchDishes: [] })
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
      this.setData({ hasMenu, breakfastDishes, lunchDishes })
      if (manual) {
        wx.showToast({ title: '已刷新', icon: 'success', duration: 900 })
      }
    } catch {
      this.setData({ hasMenu: false })
    } finally {
      if (manual) {
        const remain = 600 - (Date.now() - refreshStartedAt)
        if (remain > 0) await sleep(remain)
      }
      if (!silent) this.setData({ loading: false })
      if (manual) {
        wx.hideLoading()
        this.setData({ refreshing: false })
      }
    }
  },

  onRefresh() {
    if (this.data.refreshing || this.data.loading) return
    this.loadMenu({ manual: true, silent: this.data.hasMenu })
  },
})
