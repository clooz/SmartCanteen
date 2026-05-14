const api = require('../../utils/api')
const { getToken } = require('../../utils/storage')

Page({
  data: {
    loading: true,
    submitting: false,
    mealType: 'lunch',
    breakfastDishes: [],
    lunchDishes: [],
    ordering: null,
    breakfastTabTag: '',
    lunchTabTag: '',
    breakfastTabTone: '',
    lunchTabTone: '',
    orderMealBlocked: false,
    orderBlockedTitle: '',
    orderBlockedSub: '',
    quantities: {},
    remark: '',
    totalText: '0.00',
    totalCount: 0,
    canSubmit: false,
  },

  onLoad() {
    if (!getToken()) {
      wx.reLaunch({ url: '/pages/login/login' })
      return
    }
    this.loadPage()
  },

  onShow() {
    if (getToken()) this.loadPage({ silent: true })
  },

  async loadPage(options = {}) {
    const silent = options.silent === true
    if (!silent) this.setData({ loading: true })
    try {
      const res = await api.getTodayMenu({ _t: Date.now() })
      const menu = res.data
      if (!menu) {
        this.setData({
          breakfastDishes: [],
          lunchDishes: [],
          ordering: null,
          mealType: 'lunch',
          quantities: {},
          totalText: '0.00',
          totalCount: 0,
          canSubmit: false,
          breakfastTabTag: '',
          lunchTabTag: '',
          breakfastTabTone: '',
          lunchTabTone: '',
          orderMealBlocked: false,
          orderBlockedTitle: '',
          orderBlockedSub: '',
        })
        return
      }
      const normalize = d => ({
        ...d,
        image_url: api.resolveAssetUrl(d.image_url),
      })
      const all = menu.dishes || []
      const breakfastDishes = all.filter(d => d.meal_type === 'breakfast').map(normalize)
      const lunchDishes = all.filter(d => !d.meal_type || d.meal_type === 'lunch').map(normalize)
      let { mealType, quantities } = this.data
      if (mealType === 'breakfast' && breakfastDishes.length === 0) {
        mealType = lunchDishes.length ? 'lunch' : 'lunch'
      }
      if (mealType === 'lunch' && lunchDishes.length === 0 && breakfastDishes.length) {
        mealType = 'breakfast'
      }
      quantities = this._trimQuantitiesForDishes(breakfastDishes, lunchDishes, quantities)
      const tabUi = this._mealTabUi(menu.ordering)
      this.setData({
        breakfastDishes,
        lunchDishes,
        ordering: menu.ordering || null,
        mealType,
        quantities,
        ...tabUi,
      })
      this.updateTotal()
    } catch {
      if (!silent) {
        this.setData({
          breakfastDishes: [],
          lunchDishes: [],
          ordering: null,
          totalText: '0.00',
          totalCount: 0,
          canSubmit: false,
          breakfastTabTag: '',
          lunchTabTag: '',
          breakfastTabTone: '',
          lunchTabTone: '',
          orderMealBlocked: false,
          orderBlockedTitle: '',
          orderBlockedSub: '',
        })
      }
    } finally {
      if (!silent) this.setData({ loading: false })
    }
  },

  _mealTabUi(ordering) {
    if (!ordering) {
      return {
        breakfastTabTag: '',
        lunchTabTag: '',
        breakfastTabTone: '',
        lunchTabTone: '',
      }
    }
    const tone = (slot) => {
      if (!slot) return ''
      if (slot.accepting) return 'ok'
      if (slot.reasonCode === 'ended') return 'end'
      if (slot.reasonCode === 'not_started') return 'wait'
      return 'off'
    }
    const tag = (slot) => {
      if (!slot) return ''
      if (slot.accepting) return '可订'
      switch (slot.reasonCode) {
        case 'not_started':
          return '未开始'
        case 'ended':
          return '已结束'
        default:
          return '不可订'
      }
    }
    return {
      breakfastTabTag: tag(ordering.breakfast),
      lunchTabTag: tag(ordering.lunch),
      breakfastTabTone: tone(ordering.breakfast),
      lunchTabTone: tone(ordering.lunch),
    }
  },

  _trimQuantitiesForDishes(bf, lu, quantities) {
    const ids = new Set([...bf.map(d => d.id), ...lu.map(d => d.id)])
    const next = {}
    Object.keys(quantities || {}).forEach((k) => {
      const id = Number(k)
      if (ids.has(id) && quantities[k] > 0) next[id] = quantities[k]
    })
    return next
  },

  switchMeal(e) {
    const t = e.currentTarget.dataset.type
    if (!t || t === this.data.mealType) return
    this.setData({ mealType: t })
    this.updateTotal()
  },

  maxQty(dish) {
    if (dish.stock == null || dish.stock === '') return 99
    const n = Number(dish.stock)
    if (Number.isNaN(n) || n < 0) return 99
    return Math.min(99, n)
  },

  incQty(e) {
    if (this.data.orderMealBlocked) return
    const id = Number(e.currentTarget.dataset.id)
    const dish = this._findDish(id)
    if (!dish) return
    const cur = this.data.quantities[id] || 0
    const max = this.maxQty(dish)
    if (cur >= max) {
      wx.showToast({ title: max === 0 ? '暂无可订份数' : '已达库存上限', icon: 'none' })
      return
    }
    const quantities = { ...this.data.quantities, [id]: cur + 1 }
    this.setData({ quantities })
    this.updateTotal()
  },

  decQty(e) {
    if (this.data.orderMealBlocked) return
    const id = Number(e.currentTarget.dataset.id)
    const cur = this.data.quantities[id] || 0
    if (cur <= 0) return
    const quantities = { ...this.data.quantities }
    if (cur <= 1) delete quantities[id]
    else quantities[id] = cur - 1
    this.setData({ quantities })
    this.updateTotal()
  },

  _findDish(id) {
    const { breakfastDishes, lunchDishes } = this.data
    return [...breakfastDishes, ...lunchDishes].find(d => d.id === id)
  },

  updateTotal() {
    const { mealType, breakfastDishes, lunchDishes, quantities, ordering } = this.data
    const dishes = mealType === 'breakfast' ? breakfastDishes : lunchDishes
    let total = 0
    let count = 0
    dishes.forEach((d) => {
      const q = quantities[d.id] || 0
      if (q > 0) {
        count += q
        total += Number(d.price) * q
      }
    })
    const mealOrd = ordering && ordering[mealType]
    const canSubmit = count > 0 && dishes.length > 0 && !!(mealOrd && mealOrd.accepting)
    const blocked = !!(mealOrd && !mealOrd.accepting && dishes.length > 0)
    const name = mealType === 'breakfast' ? '早餐' : '午餐'
    let orderBlockedTitle = ''
    let orderBlockedSub = ''
    if (blocked) {
      const msg = (mealOrd.message || '').trim()
      const win = (mealOrd.window || '').trim()
      const rc = mealOrd.reasonCode
      if (rc === 'not_started') {
        orderBlockedTitle = `${name}尚未开放订餐`
        orderBlockedSub = msg || (win ? `订餐时段 ${win}` : '')
      } else if (rc === 'ended') {
        orderBlockedTitle = `${name}订餐已结束，不支持下单`
        orderBlockedSub = msg || (win ? `订餐时段 ${win}` : '')
      } else {
        orderBlockedTitle = `${name}当前不可订餐`
        orderBlockedSub = msg || (win ? `时段 ${win}` : '')
      }
    }
    const tabUi = this._mealTabUi(ordering)
    this.setData({
      totalText: total.toFixed(2),
      totalCount: count,
      canSubmit,
      orderMealBlocked: blocked,
      orderBlockedTitle,
      orderBlockedSub,
      ...tabUi,
    })
  },

  onRemark(e) {
    this.setData({ remark: e.detail.value })
  },

  async submit() {
    const { mealType, remark, breakfastDishes, lunchDishes, quantities, submitting, canSubmit } = this.data
    if (submitting) return
    if (!canSubmit) {
      const mealOrd = this.data.ordering && this.data.ordering[mealType]
      const tip = mealOrd && !mealOrd.accepting
        ? (mealOrd.message || '当前餐次不可订餐')
        : '请选择至少一道菜'
      wx.showToast({ title: tip, icon: 'none' })
      return
    }
    const dishes = mealType === 'breakfast' ? breakfastDishes : lunchDishes
    const items = dishes
      .map(d => ({ dish_id: d.id, quantity: quantities[d.id] || 0 }))
      .filter(it => it.quantity > 0)
    if (!items.length) {
      wx.showToast({ title: '请至少选择一道菜', icon: 'none' })
      return
    }
    this.setData({ submitting: true })
    try {
      await api.createOrder({
        items,
        remark: (remark || '').trim(),
        meal_type: mealType,
      })
      wx.showToast({ title: '下单成功', icon: 'success' })
      this.setData({ quantities: {}, remark: '', totalText: '0.00', totalCount: 0, canSubmit: false })
      setTimeout(() => {
        wx.navigateTo({ url: '/pages/my-orders/my-orders' })
      }, 450)
    } catch {
      /* api 已 toast */
    } finally {
      this.setData({ submitting: false })
    }
  },

  goOrders() {
    wx.navigateTo({ url: '/pages/my-orders/my-orders' })
  },
})
