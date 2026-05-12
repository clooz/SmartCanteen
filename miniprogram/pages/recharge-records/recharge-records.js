const api = require('../../utils/api')

function formatDateTime(str) {
  if (!str) return '-'
  const d = new Date(str)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

Page({
  data: {
    records: [],
    loading: false,
    loadingMore: false,
    noMore: false,
    page: 1,
    pageSize: 15,
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: '充值记录' })
    this.loadRecords(true)
  },

  onPullDownRefresh() {
    this.loadRecords(true).finally(() => wx.stopPullDownRefresh())
  },

  async loadRecords(reset = false) {
    if (this.data.loading || this.data.loadingMore) return
    const page = reset ? 1 : this.data.page

    if (reset) {
      this.setData({ loading: true, records: [], noMore: false, page: 1 })
    } else {
      this.setData({ loadingMore: true })
    }

    try {
      const res = await api.getMyRecharges({ page, page_size: this.data.pageSize })
      const newItems = ((res.data && res.data.list) || res.data || []).map(r => ({
        ...r,
        createdAtStr: formatDateTime(r.created_at),
        reviewedAtStr: formatDateTime(r.reviewed_at),
        proof_image_url: api.resolveAssetUrl(r.proof_image_url),
      }))
      const records = reset ? newItems : [...this.data.records, ...newItems]
      this.setData({
        records,
        page: page + 1,
        noMore: newItems.length < this.data.pageSize,
      })
    } catch {
      this.setData({ noMore: true })
    } finally {
      this.setData({ loading: false, loadingMore: false })
    }
  },

  onLoadMore() {
    if (!this.data.noMore) this.loadRecords(false)
  },

  previewProof(e) {
    const url = e.currentTarget.dataset.url
    if (url) wx.previewImage({ current: url, urls: [url] })
  },
})
