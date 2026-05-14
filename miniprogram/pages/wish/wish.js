const api = require('../../utils/api')
const { getToken } = require('../../utils/storage')

function formatCountdown(endAt) {
  const diff = new Date(endAt) - Date.now()
  if (diff <= 0) return '已结束'
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  if (days > 0) return `剩余 ${days} 天`
  if (hours > 0) return `剩余 ${hours} 小时`
  return '即将结束'
}

function formatDate(str) {
  const d = new Date(str)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatDateShort(str) {
  const d = new Date(str)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

Page({
  data: {
    statusBarHeight: 20,
    filterTab: 'all',
    filterIndex: 0,
    statusFilterRange: [
      { value: 'all', label: '全部' },
      { value: 'active', label: '进行中' },
      { value: 'closed', label: '已结束' },
    ],
    searchKeyword: '',
    activitiesRaw: [],
    activities: [],
    loading: false,
    emptyMode: 'none',
  },

  onLoad() {
    if (!getToken()) { wx.reLaunch({ url: '/pages/login/login' }); return }
    const sys = wx.getSystemInfoSync()
    let statusBarHeight = sys.statusBarHeight || 20
    try {
      const menu = wx.getMenuButtonBoundingClientRect()
      if (menu && menu.top > 0) {
        statusBarHeight = menu.top
      }
    } catch (_) {}
    this.setData({ statusBarHeight })
    this.loadActivities()
  },

  onShow() { this.loadActivities() },

  onUnload() {
    if (this._searchTimer) clearTimeout(this._searchTimer)
  },

  onPullDownRefresh() {
    this.loadActivities().finally(() => wx.stopPullDownRefresh())
  },

  mapActivityRow(a) {
    return {
      ...a,
      endAtStr: formatDate(a.end_at),
      createdAtStr: formatDateShort(a.created_at),
      countdown: a.status === 'active' ? formatCountdown(a.end_at) : '',
    }
  },

  applySearch() {
    const { activitiesRaw, searchKeyword, loading } = this.data
    const kw = (searchKeyword || '').trim().toLowerCase()
    let list = activitiesRaw
    if (kw) {
      list = activitiesRaw.filter((a) => {
        const t = (a.title || '').toLowerCase()
        const desc = (a.description || '').toLowerCase()
        return t.includes(kw) || desc.includes(kw)
      })
    }
    let emptyMode = 'none'
    if (!loading) {
      if (activitiesRaw.length === 0) emptyMode = 'nodata'
      else if (list.length === 0) emptyMode = 'nomatch'
    }
    this.setData({ activities: list, emptyMode })
  },

  async loadActivities() {
    this.setData({ loading: true })
    const { filterTab } = this.data
    const params = {}
    if (filterTab === 'active') params.status = 'active'
    else if (filterTab === 'closed') params.status = 'closed'
    try {
      const res = await api.getWishActivities(params)
      const activitiesRaw = (res.data || []).map((a) => this.mapActivityRow(a))
      this.setData({ activitiesRaw })
    } catch {
      this.setData({ activitiesRaw: [] })
    } finally {
      this.setData({ loading: false })
      this.applySearch()
    }
  },

  onSearchInput(e) {
    const searchKeyword = e.detail.value || ''
    this.setData({ searchKeyword })
    if (this._searchTimer) clearTimeout(this._searchTimer)
    this._searchTimer = setTimeout(() => {
      this._searchTimer = null
      this.applySearch()
    }, 220)
  },

  clearSearch() {
    if (this._searchTimer) clearTimeout(this._searchTimer)
    this._searchTimer = null
    this.setData({ searchKeyword: '' })
    this.applySearch()
  },

  onFilterPick(e) {
    const idx = Number(e.detail.value)
    const row = this.data.statusFilterRange[idx]
    if (!row || row.value === this.data.filterTab) return
    this.setData({ filterTab: row.value, filterIndex: idx })
    this.loadActivities()
  },

  goDetail(e) {
    const { id, title } = e.currentTarget.dataset
    wx.navigateTo({ url: `/pages/wish-detail/wish-detail?id=${id}&title=${encodeURIComponent(title)}` })
  },
})
