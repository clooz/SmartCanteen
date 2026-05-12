const api = require('../../utils/api')
const { getToken } = require('../../utils/storage')

Page({
  data: {
    loading: false,
    hasMenu: false,
    breakfastDishes: [],
    lunchDishes: [],
    todayStr: '',
  },

  onLoad() {
    this.setTodayStr()
    this.checkLoginAndLoad()
  },

  onShow() {
    this.checkLoginAndLoad()
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
      wx.reLaunch({ url: '/pages/login/login' })
      return
    }
    this.loadMenu()
  },

  async loadMenu() {
    this.setData({ loading: true })
    try {
      const res = await api.getTodayMenu()
      const menu = res.data
      if (!menu) {
        this.setData({ hasMenu: false, breakfastDishes: [], lunchDishes: [] })
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
    } catch {
      this.setData({ hasMenu: false })
    } finally {
      this.setData({ loading: false })
    }
  },

  onRefresh() {
    this.loadMenu()
  },
})
