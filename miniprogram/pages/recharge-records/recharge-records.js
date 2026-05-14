const api = require('../../utils/api')

function formatDateTime(str) {
  if (!str) return '-'
  const d = new Date(str)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function localYMD(d) {
  const x = d instanceof Date ? d : new Date(d)
  const pad = n => String(n).padStart(2, '0')
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`
}

Page({
  data: {
    records: [],
    loading: false,
    loadingMore: false,
    noMore: false,
    page: 1,
    pageSize: 15,
    filterStatus: 'ALL',
    filterRange: 'ALL',
    draftStatus: 'ALL',
    draftRange: 'ALL',
    showFilterSheet: false,
    filterSummaryText: '全部',
    statusChips: [
      { label: '全部', value: 'ALL' },
      { label: '待审核', value: 'pending' },
      { label: '已到账', value: 'completed' },
      { label: '已拒绝', value: 'rejected' },
    ],
    rangeChips: [
      { label: '全部', value: 'ALL' },
      { label: '近7天', value: '7' },
      { label: '近30天', value: '30' },
    ],
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: '充值记录' })
    this.loadRecords(true)
  },

  onPullDownRefresh() {
    this.loadRecords(true).finally(() => wx.stopPullDownRefresh())
  },

  _syncFilterSummary() {
    const { filterStatus, filterRange, statusChips, rangeChips } = this.data
    const st = (statusChips.find(c => c.value === filterStatus) || {}).label || '全部'
    const rg = (rangeChips.find(c => c.value === filterRange) || {}).label || '全部'
    let text = '全部'
    if (filterStatus === 'ALL' && filterRange === 'ALL') text = '全部'
    else if (filterStatus !== 'ALL' && filterRange !== 'ALL') text = `${st} · ${rg}`
    else if (filterStatus !== 'ALL') text = st
    else text = rg
    this.setData({ filterSummaryText: text })
  },

  openFilterSheet() {
    const { filterStatus, filterRange } = this.data
    this.setData({
      showFilterSheet: true,
      draftStatus: filterStatus,
      draftRange: filterRange,
    })
  },

  closeFilterSheet() {
    this.setData({ showFilterSheet: false })
  },

  onDraftStatus(e) {
    const v = String(e.currentTarget.dataset.value || 'ALL')
    this.setData({ draftStatus: v })
  },

  onDraftRange(e) {
    const v = String(e.currentTarget.dataset.value || 'ALL')
    this.setData({ draftRange: v })
  },

  resetDraftFilter() {
    this.setData({ draftStatus: 'ALL', draftRange: 'ALL' })
  },

  applyFilterFromSheet() {
    const { draftStatus, draftRange } = this.data
    this.setData({
      filterStatus: draftStatus,
      filterRange: draftRange,
      showFilterSheet: false,
    })
    this._syncFilterSummary()
    this.loadRecords(true)
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

  _listQuery(page) {
    const { filterStatus, filterRange, pageSize } = this.data
    const q = { page, page_size: pageSize }
    if (filterStatus && filterStatus !== 'ALL') q.status = filterStatus
    const { start_date, end_date } = this._computeDateRange(filterRange)
    if (start_date) q.start_date = start_date
    if (end_date) q.end_date = end_date
    return q
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
      const res = await api.getMyRecharges(this._listQuery(page))
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
      if (reset) this._syncFilterSummary()
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
