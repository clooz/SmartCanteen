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
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

Page({
  data: {
    loading: false,
    activities: [],
  },

  onLoad() {
    if (!getToken()) { wx.reLaunch({ url: '/pages/login/login' }); return }
    this.loadActivities()
  },

  onShow() { this.loadActivities() },

  onPullDownRefresh() {
    this.loadActivities().finally(() => wx.stopPullDownRefresh())
  },

  async loadActivities() {
    this.setData({ loading: true })
    try {
      const res = await api.getWishActivities()
      const activities = (res.data || []).map(a => ({
        ...a,
        endAtStr: formatDate(a.end_at),
        countdown: a.status === 'active' ? formatCountdown(a.end_at) : '',
      }))
      this.setData({ activities })
    } catch {
      this.setData({ activities: [] })
    } finally {
      this.setData({ loading: false })
    }
  },

  goDetail(e) {
    const { id, title } = e.currentTarget.dataset
    wx.navigateTo({ url: `/pages/wish-detail/wish-detail?id=${id}&title=${encodeURIComponent(title)}` })
  },
})
