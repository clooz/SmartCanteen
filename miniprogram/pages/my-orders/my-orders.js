const api = require('../../utils/api')
const { getToken } = require('../../utils/storage')

const STATUS_LABEL = {
  pending: '待接单',
  confirmed: '制作中',
  ready: '可取餐',
  done: '已完成',
  cancelled: '已取消',
}

function localYMD(d) {
  const x = d instanceof Date ? d : new Date(d)
  const pad = n => String(n).padStart(2, '0')
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`
}

Page({
  data: {
    loading: true,
    orders: [],
    detailOrder: null,
    filterStatus: 'ALL',
    filterMeal: 'ALL',
    filterRange: 'ALL',
    draftStatus: 'ALL',
    draftMeal: 'ALL',
    draftRange: 'ALL',
    showFilterSheet: false,
    filterSummaryText: '全部',
    statusChips: [
      { label: '全部', value: 'ALL' },
      { label: '待接单', value: 'pending' },
      { label: '制作中', value: 'confirmed' },
      { label: '可取餐', value: 'ready' },
      { label: '已完成', value: 'done' },
      { label: '已取消', value: 'cancelled' },
    ],
    mealChips: [
      { label: '全部', value: 'ALL' },
      { label: '早餐', value: 'breakfast' },
      { label: '午餐', value: 'lunch' },
    ],
    rangeChips: [
      { label: '全部', value: 'ALL' },
      { label: '近7天', value: '7' },
      { label: '近30天', value: '30' },
    ],
  },

  onLoad() {
    if (!getToken()) {
      wx.reLaunch({ url: '/pages/login/login' })
      return
    }
    this.loadList()
  },

  onPullDownRefresh() {
    this.loadList().finally(() => wx.stopPullDownRefresh())
  },

  _computeDateRange(rangeKey) {
    if (!rangeKey || rangeKey === 'ALL') return { start_date: '', end_date: '' }
    const end = new Date()
    end.setHours(0, 0, 0, 0)
    const start = new Date(end)
    const days = rangeKey === '30' ? 29 : 6
    start.setDate(start.getDate() - days)
    return { start_date: localYMD(start), end_date: localYMD(end) }
  },

  _listQuery() {
    const { filterStatus, filterMeal, filterRange } = this.data
    const q = { page: 1, page_size: 100 }
    if (filterStatus && filterStatus !== 'ALL') q.status = filterStatus
    if (filterMeal && filterMeal !== 'ALL') q.meal_type = filterMeal
    const { start_date, end_date } = this._computeDateRange(filterRange)
    if (start_date) q.start_date = start_date
    if (end_date) q.end_date = end_date
    return q
  },

  _syncFilterSummary() {
    const { filterStatus, filterMeal, filterRange, statusChips, mealChips, rangeChips } = this.data
    const st = (statusChips.find(c => c.value === filterStatus) || {}).label
    const ml = (mealChips.find(c => c.value === filterMeal) || {}).label
    const rg = (rangeChips.find(c => c.value === filterRange) || {}).label
    if (filterStatus === 'ALL' && filterMeal === 'ALL' && filterRange === 'ALL') {
      this.setData({ filterSummaryText: '全部' })
      return
    }
    const parts = []
    if (filterStatus !== 'ALL') parts.push(st)
    if (filterMeal !== 'ALL') parts.push(ml)
    if (filterRange !== 'ALL') parts.push(rg)
    this.setData({ filterSummaryText: parts.join(' · ') })
  },

  openFilterSheet() {
    const { filterStatus, filterMeal, filterRange } = this.data
    this.setData({
      showFilterSheet: true,
      draftStatus: filterStatus,
      draftMeal: filterMeal,
      draftRange: filterRange,
      detailOrder: null,
    })
  },

  closeFilterSheet() {
    this.setData({ showFilterSheet: false })
  },

  onDraftStatus(e) {
    this.setData({ draftStatus: String(e.currentTarget.dataset.value || 'ALL') })
  },

  onDraftMeal(e) {
    this.setData({ draftMeal: String(e.currentTarget.dataset.value || 'ALL') })
  },

  onDraftRange(e) {
    this.setData({ draftRange: String(e.currentTarget.dataset.value || 'ALL') })
  },

  resetDraftFilter() {
    this.setData({ draftStatus: 'ALL', draftMeal: 'ALL', draftRange: 'ALL' })
  },

  applyFilterFromSheet() {
    const { draftStatus, draftMeal, draftRange } = this.data
    this.setData({
      filterStatus: draftStatus,
      filterMeal: draftMeal,
      filterRange: draftRange,
      showFilterSheet: false,
    })
    this._syncFilterSummary()
    this.loadList()
  },

  async loadList() {
    this.setData({ loading: true })
    try {
      const res = await api.getMyOrders(this._listQuery())
      const list = (res.data && res.data.list) ? res.data.list : []
      const orders = list.map((o) => ({
        ...o,
        statusLabel: STATUS_LABEL[o.status] || o.status,
        total_amount: Number(o.total_amount).toFixed(2),
        mealLabel: o.meal_type === 'breakfast' ? '早餐' : '午餐',
        createdShort: this._fmtTime(o.created_at),
        items: (o.items || []).map(it => ({
          ...it,
          dish_price: Number(it.dish_price).toFixed(2),
          subtotal: Number(it.subtotal).toFixed(2),
        })),
      }))
      this.setData({ orders })
      this._syncFilterSummary()
    } catch {
      this.setData({ orders: [] })
      this._syncFilterSummary()
    } finally {
      this.setData({ loading: false })
    }
  },

  _fmtTime(str) {
    if (!str) return ''
    const d = new Date(str)
    const pad = n => String(n).padStart(2, '0')
    return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  },

  showDetail(e) {
    const id = Number(e.currentTarget.dataset.id)
    const o = this.data.orders.find(x => x.id === id)
    if (o) this.setData({ detailOrder: o })
  },

  closeDetail() {
    this.setData({ detailOrder: null })
  },

  goOrder() {
    wx.navigateTo({ url: '/pages/order/order' })
  },

  cancelOrder() {
    const order = this.data.detailOrder
    if (!order || order.status !== 'pending') return
    wx.showModal({
      title: '取消订单',
      content: '仅待接单可取消，确定取消该订单？',
      success: async ({ confirm }) => {
        if (!confirm) return
        try {
          await api.cancelOrder(order.id)
          wx.showToast({ title: '已取消', icon: 'success' })
          this.setData({ detailOrder: null })
          this.loadList()
        } catch {
          /* api 已 toast */
        }
      },
    })
  },
})
