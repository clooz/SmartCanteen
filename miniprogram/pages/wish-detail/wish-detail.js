const api = require('../../utils/api')
const { getUserInfo } = require('../../utils/storage')

function formatTime(str) {
  const d = new Date(str)
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  return `${d.getMonth() + 1}/${d.getDate()}`
}

Page({
  data: {
    activityId: null,
    activityTitle: '',
    isActive: false,
    loading: false,
    wishItems: [],
    expandedId: null,
    comments: [],
    commentLoading: false,
    showCommentInput: false,
    commentText: '',
    commentInputFocus: false,
    currentCommentItemId: null,
    showWishSheet: false,
    wishName: '',
    wishDesc: '',
    myUserId: null,
  },

  onLoad(options) {
    const userInfo = getUserInfo()
    this.setData({
      activityId: Number(options.id),
      activityTitle: decodeURIComponent(options.title || ''),
      myUserId: userInfo ? userInfo.id : null,
    })
    wx.setNavigationBarTitle({ title: decodeURIComponent(options.title || '许愿详情') })
    this.loadItems()
  },

  onShow() { this.loadItems() },

  onPullDownRefresh() {
    this.loadItems().finally(() => wx.stopPullDownRefresh())
  },

  async loadItems() {
    this.setData({ loading: true })
    try {
      const res = await api.getWishItems(this.data.activityId)
      const items = (res.data || []).map(item => ({
        ...item,
        createdAtStr: formatTime(item.created_at),
        comment_count: item.comment_count || 0,
      }))
      const isActive = items.length > 0
        ? true
        : this.data.isActive

      // 判断活动状态（从第一条数据的activity_status，或复用现有状态）
      this.setData({ wishItems: items, loading: false })

      // 判断活动是否进行中（从活动列表缓存）
      try {
        const actRes = await api.getWishActivities()
        const act = (actRes.data || []).find(a => a.id === this.data.activityId)
        if (act) this.setData({ isActive: act.status === 'active' })
      } catch {}
    } catch {
      this.setData({ loading: false })
    }
  },

  async toggleLike(e) {
    const { id, index } = e.currentTarget.dataset
    const item = this.data.wishItems[index]
    const wasVoted = item.has_voted

    // 乐观更新
    const updated = [...this.data.wishItems]
    updated[index] = {
      ...item,
      has_voted: !wasVoted,
      vote_count: wasVoted ? item.vote_count - 1 : item.vote_count + 1,
    }
    this.setData({ wishItems: updated })

    try {
      if (wasVoted) {
        await api.unvoteWishItem(id)
      } else {
        await api.voteWishItem(id)
      }
    } catch {
      // 回滚
      const rollback = [...this.data.wishItems]
      rollback[index] = item
      this.setData({ wishItems: rollback })
    }
  },

  async toggleComments(e) {
    const { id } = e.currentTarget.dataset
    const { expandedId } = this.data

    if (expandedId === id) {
      // 收起
      this.setData({ expandedId: null, showCommentInput: false, commentText: '' })
      return
    }

    this.setData({ expandedId: id, comments: [], commentLoading: true, showCommentInput: true, currentCommentItemId: id })
    this.loadComments(id)
  },

  async loadComments(itemId) {
    this.setData({ commentLoading: true })
    try {
      const res = await api.getComments(itemId)
      const comments = (res.data || []).map(c => ({
        ...c,
        createdAtStr: formatTime(c.created_at),
      }))
      this.setData({ comments, commentLoading: false })
    } catch {
      this.setData({ commentLoading: false })
    }
  },

  onCommentInput(e) {
    this.setData({ commentText: e.detail.value })
  },

  async submitComment() {
    const { commentText, currentCommentItemId, expandedId } = this.data
    if (!commentText.trim()) return

    try {
      await api.createComment(currentCommentItemId, { content: commentText.trim() })
      this.setData({ commentText: '' })
      wx.showToast({ title: '评论成功', icon: 'success', duration: 1200 })

      // 刷新评论列表和评论数
      this.loadComments(expandedId)

      // 更新对应愿望的 comment_count
      const idx = this.data.wishItems.findIndex(w => w.id === expandedId)
      if (idx >= 0) {
        const updated = [...this.data.wishItems]
        updated[idx] = { ...updated[idx], comment_count: (updated[idx].comment_count || 0) + 1 }
        this.setData({ wishItems: updated })
      }
    } catch {}
  },

  async deleteComment(e) {
    const { commentId, itemId } = e.currentTarget.dataset
    wx.showModal({
      title: '删除评论',
      content: '确定删除这条评论吗？',
      confirmText: '删除',
      confirmColor: '#DC2626',
      success: async ({ confirm }) => {
        if (!confirm) return
        try {
          await api.deleteComment(itemId, commentId)
          wx.showToast({ title: '已删除', icon: 'success', duration: 1000 })
          this.loadComments(itemId)
          const idx = this.data.wishItems.findIndex(w => w.id === Number(itemId))
          if (idx >= 0) {
            const updated = [...this.data.wishItems]
            updated[idx] = { ...updated[idx], comment_count: Math.max(0, (updated[idx].comment_count || 1) - 1) }
            this.setData({ wishItems: updated })
          }
        } catch {}
      }
    })
  },

  showWishSheet() { this.setData({ showWishSheet: true, wishName: '', wishDesc: '' }) },
  hideWishSheet() { this.setData({ showWishSheet: false }) },

  onWishInput(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ [key]: e.detail.value })
  },

  async submitWish() {
    const { wishName, wishDesc, activityId } = this.data
    if (!wishName.trim()) { wx.showToast({ title: '请填写想吃的菜名', icon: 'none' }); return }

    try {
      await api.createWishItem(activityId, { dish_name: wishName.trim(), description: wishDesc.trim() })
      wx.showToast({ title: '许愿成功！', icon: 'success' })
      this.setData({ showWishSheet: false })
      this.loadItems()
    } catch {}
  },
})
