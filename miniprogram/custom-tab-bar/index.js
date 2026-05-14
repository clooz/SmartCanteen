'use strict'

const ROUTE_TO_ACTIVE = {
  'pages/index/index': 0,
  'pages/wish/wish': 1,
  'pages/recharge/recharge': 2,
  'pages/profile/profile': 3,
}

Component({
  data: {
    active: 0,
  },

  lifetimes: {
    ready() {
      this.syncSelected()
    },
  },

  methods: {
    syncSelected() {
      const page = getCurrentPages().pop()
      if (!page) return
      const idx = ROUTE_TO_ACTIVE[page.route]
      if (idx === undefined) return
      if (this.data.active !== idx) this.setData({ active: idx })
    },
  },
})
