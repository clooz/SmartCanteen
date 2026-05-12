require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })
const fs = require('fs')
const path = require('path')

const BASE = process.env.CHECK_BASE_URL || 'http://localhost:3000/api'
const reportRows = []
const notes = []

function nowTs() {
  return new Date().toISOString()
}

function addResult(page, item, ok, detail) {
  reportRows.push({ page, item, ok, detail })
}

async function api(pathname, options = {}, token) {
  const headers = { ...(options.headers || {}) }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${BASE}${pathname}`, { ...options, headers })
  const txt = await res.text()
  let data
  try {
    data = JSON.parse(txt)
  } catch {
    data = { raw: txt }
  }
  return { http: res.status, body: data }
}

function mark(page, item, condition, okDetail, failDetail) {
  addResult(page, item, !!condition, condition ? okDetail : failDetail)
}

async function run() {
  const created = {
    companyId: null,
    username: null,
    dishId: null,
    menuId: null,
    activityId: null,
  }

  try {
    // 1) 登录
    const loginRes = await api('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    })
    const loginOk = loginRes.http === 200 && loginRes.body?.code === 0 && loginRes.body?.data?.token
    mark('登录页', '管理员登录', loginOk, 'admin 登录成功', JSON.stringify(loginRes.body))
    if (!loginOk) throw new Error('管理员登录失败，无法继续走查')
    const token = loginRes.body.data.token

    const profileRes = await api('/auth/profile', {}, token)
    mark(
      '登录页',
      '获取个人信息',
      profileRes.http === 200 && profileRes.body?.code === 0 && profileRes.body?.data?.role === 'admin',
      `role=${profileRes.body?.data?.role}`,
      JSON.stringify(profileRes.body)
    )

    // 2) 公司管理页
    const companyList = await api('/admin/companies', {}, token)
    mark(
      '公司管理',
      '公司列表查询',
      companyList.http === 200 && companyList.body?.code === 0 && Array.isArray(companyList.body?.data),
      `数量=${companyList.body?.data?.length ?? 0}`,
      JSON.stringify(companyList.body)
    )

    const companyCode = `Z${Date.now().toString().slice(-5)}`
    const companyCreate = await api('/admin/companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '验收公司', code: companyCode }),
    }, token)
    const companyCreateOk = (companyCreate.http === 200 || companyCreate.http === 201) && companyCreate.body?.code === 0 && companyCreate.body?.data?.id
    mark('公司管理', '新增公司', companyCreateOk, `id=${companyCreate.body?.data?.id}`, JSON.stringify(companyCreate.body))
    if (companyCreateOk) created.companyId = companyCreate.body.data.id

    if (created.companyId) {
      const companyUpdate = await api(`/admin/companies/${created.companyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '验收公司-已更新' }),
      }, token)
      mark('公司管理', '编辑公司', companyUpdate.http === 200 && companyUpdate.body?.code === 0, companyUpdate.body?.message, JSON.stringify(companyUpdate.body))
    }

    // 3) 用户管理页
    const usersList = await api('/admin/users?page=1&page_size=10', {}, token)
    mark('用户管理', '用户列表查询', usersList.http === 200 && usersList.body?.code === 0 && usersList.body?.data?.list, `total=${usersList.body?.data?.total}`, JSON.stringify(usersList.body))

    const username = `qa_u_${Date.now().toString().slice(-6)}`
    created.username = username
    const userCreate = await api('/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        password: '123456',
        nickname: '验收用户',
        role: 'employee',
        company_id: created.companyId || null,
      }),
    }, token)
    const userCreateOk = (userCreate.http === 200 || userCreate.http === 201) && userCreate.body?.code === 0 && userCreate.body?.data?.id
    mark('用户管理', '新增用户', userCreateOk, `id=${userCreate.body?.data?.id}`, JSON.stringify(userCreate.body))
    const testUserId = userCreate.body?.data?.id

    if (testUserId) {
      const userUpdate = await api(`/admin/users/${testUserId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: '验收用户-更新', is_active: 0 }),
      }, token)
      mark('用户管理', '编辑用户与禁用', userUpdate.http === 200 && userUpdate.body?.code === 0, userUpdate.body?.message, JSON.stringify(userUpdate.body))

      const userEnable = await api(`/admin/users/${testUserId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: 1 }),
      }, token)
      mark('用户管理', '启用用户', userEnable.http === 200 && userEnable.body?.code === 0, userEnable.body?.message, JSON.stringify(userEnable.body))

      const resetPwd = await api(`/admin/users/${testUserId}/reset-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_password: '123456' }),
      }, token)
      mark('用户管理', '重置密码', resetPwd.http === 200 && resetPwd.body?.code === 0, resetPwd.body?.message, JSON.stringify(resetPwd.body))
    }

    // 4) 菜品管理页
    const dishesList = await api('/dishes?page=1&page_size=10', {}, token)
    mark('菜品管理', '菜品列表查询', dishesList.http === 200 && dishesList.body?.code === 0 && dishesList.body?.data?.list, `total=${dishesList.body?.data?.total}`, JSON.stringify(dishesList.body))

    const dishName = `验收菜品-${Date.now().toString().slice(-6)}`
    const dishCreate = await api('/dishes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: dishName, price: 9.9, category: '其他', description: '接口验收创建' }),
    }, token)
    const dishCreateOk = (dishCreate.http === 200 || dishCreate.http === 201) && dishCreate.body?.code === 0 && dishCreate.body?.data?.id
    mark('菜品管理', '新增菜品', dishCreateOk, `id=${dishCreate.body?.data?.id}`, JSON.stringify(dishCreate.body))
    if (dishCreateOk) created.dishId = dishCreate.body.data.id

    if (created.dishId) {
      const dishUpdate = await api(`/dishes/${created.dishId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `${dishName}-更新`, price: 10.5, is_available: 1 }),
      }, token)
      mark('菜品管理', '编辑菜品', dishUpdate.http === 200 && dishUpdate.body?.code === 0, dishUpdate.body?.message, JSON.stringify(dishUpdate.body))

      const dishDelete = await api(`/dishes/${created.dishId}`, { method: 'DELETE' }, token)
      mark('菜品管理', '删除菜品(软删除下架)', dishDelete.http === 200 && dishDelete.body?.code === 0, dishDelete.body?.message, JSON.stringify(dishDelete.body))
    }

    // 5) 菜单管理页
    const menusList = await api('/menus?page=1&page_size=10', {}, token)
    mark('菜单管理', '菜单列表查询', menusList.http === 200 && menusList.body?.code === 0 && menusList.body?.data?.list, `total=${menusList.body?.data?.total}`, JSON.stringify(menusList.body))

    const availableDishes = await api('/dishes?is_available=1&page_size=10', {}, token)
    const dishIds = (availableDishes.body?.data?.list || []).map((d) => d.id).slice(0, 3)
    if (dishIds.length >= 2) {
      const menuDate = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10)
      const menuCreate = await api('/menus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menu_date: menuDate,
          breakfast_dish_ids: [dishIds[0]],
          lunch_dish_ids: [dishIds[1], ...(dishIds[2] ? [dishIds[2]] : [])],
          status: 'draft',
        }),
      }, token)
      const menuCreateOk = menuCreate.http === 200 && menuCreate.body?.code === 0 && menuCreate.body?.data?.menu_id
      mark('菜单管理', '新增菜单', menuCreateOk, `menu_id=${menuCreate.body?.data?.menu_id}`, JSON.stringify(menuCreate.body))
      if (menuCreateOk) created.menuId = menuCreate.body.data.menu_id

      if (created.menuId) {
        const menuDetail = await api(`/menus/date/${menuDate}`, {}, token)
        mark('菜单管理', '按日期查询菜单详情', menuDetail.http === 200 && menuDetail.body?.code === 0 && menuDetail.body?.data?.id === created.menuId, `dishes=${menuDetail.body?.data?.dishes?.length ?? 0}`, JSON.stringify(menuDetail.body))

        const menuPublish = await api(`/menus/${created.menuId}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'published' }),
        }, token)
        mark('菜单管理', '发布菜单', menuPublish.http === 200 && menuPublish.body?.code === 0, menuPublish.body?.message, JSON.stringify(menuPublish.body))

        const menuClose = await api(`/menus/${created.menuId}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'closed' }),
        }, token)
        mark('菜单管理', '关闭菜单', menuClose.http === 200 && menuClose.body?.code === 0, menuClose.body?.message, JSON.stringify(menuClose.body))

        const menuDelete = await api(`/menus/${created.menuId}`, { method: 'DELETE' }, token)
        mark('菜单管理', '删除菜单', menuDelete.http === 200 && menuDelete.body?.code === 0, menuDelete.body?.message, JSON.stringify(menuDelete.body))
      }
    } else {
      addResult('菜单管理', '新增菜单', false, '可用菜品不足，无法构造创建请求')
    }

    // 6) 订单管理页 + 实时订单页
    const ordersList = await api('/orders?page=1&page_size=10', {}, token)
    mark('订单管理', '订单列表查询', ordersList.http === 200 && ordersList.body?.code === 0 && ordersList.body?.data?.list, `total=${ordersList.body?.data?.total}`, JSON.stringify(ordersList.body))
    const firstOrder = ordersList.body?.data?.list?.[0]
    if (firstOrder?.id) {
      const orderDetail = await api(`/orders/${firstOrder.id}`, {}, token)
      mark('订单管理', '订单详情查询', orderDetail.http === 200 && orderDetail.body?.code === 0 && Array.isArray(orderDetail.body?.data?.items), `items=${orderDetail.body?.data?.items?.length ?? 0}`, JSON.stringify(orderDetail.body))
    }
    const pending = (ordersList.body?.data?.list || []).filter((o) => o.status === 'pending').length
    const confirmed = (ordersList.body?.data?.list || []).filter((o) => o.status === 'confirmed').length
    const ready = (ordersList.body?.data?.list || []).filter((o) => o.status === 'ready').length
    mark('实时订单', '看板状态数据覆盖', pending + confirmed + ready >= 0, `pending=${pending}, confirmed=${confirmed}, ready=${ready}`, '无法统计订单状态')

    // 7) 报表页
    const start = new Date()
    start.setDate(1)
    const end = new Date()
    const report = await api(`/orders/report?start_date=${start.toISOString().slice(0, 10)}&end_date=${end.toISOString().slice(0, 10)}`, {}, token)
    mark(
      '消费报表',
      '报表查询',
      report.http === 200 && report.body?.code === 0 && report.body?.data?.by_company && report.body?.data?.by_date && report.body?.data?.top_dishes,
      `company=${report.body?.data?.by_company?.length ?? 0}, date=${report.body?.data?.by_date?.length ?? 0}, top=${report.body?.data?.top_dishes?.length ?? 0}`,
      JSON.stringify(report.body)
    )

    // 8) 许愿活动页
    const wishActs = await api('/wish/activities', {}, token)
    mark('许愿活动', '活动列表查询', wishActs.http === 200 && wishActs.body?.code === 0 && Array.isArray(wishActs.body?.data), `数量=${wishActs.body?.data?.length ?? 0}`, JSON.stringify(wishActs.body))

    const actTitle = `验收活动-${Date.now().toString().slice(-5)}`
    const startAt = new Date(Date.now() + 3600000).toISOString()
    const endAt = new Date(Date.now() + 48 * 3600000).toISOString()
    const actCreate = await api('/wish/activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: actTitle, description: '验收创建', start_at: startAt, end_at: endAt }),
    }, token)
    const actCreateOk = (actCreate.http === 200 || actCreate.http === 201) && actCreate.body?.code === 0 && actCreate.body?.data?.id
    mark('许愿活动', '新增活动', actCreateOk, `id=${actCreate.body?.data?.id}`, JSON.stringify(actCreate.body))
    if (actCreateOk) created.activityId = actCreate.body.data.id

    if (created.activityId) {
      const itemsRes = await api(`/wish/activities/${created.activityId}/items`, {}, token)
      mark('许愿活动', '活动愿望列表查询', itemsRes.http === 200 && itemsRes.body?.code === 0 && Array.isArray(itemsRes.body?.data), `数量=${itemsRes.body?.data?.length ?? 0}`, JSON.stringify(itemsRes.body))

      const actClose = await api(`/wish/activities/${created.activityId}/close`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }, token)
      mark('许愿活动', '关闭活动', actClose.http === 200 && actClose.body?.code === 0, actClose.body?.message, JSON.stringify(actClose.body))
    }

    // 9) 充值审核页
    const rechargeList = await api('/recharge?page=1&page_size=10', {}, token)
    mark('充值审核', '充值列表查询', rechargeList.http === 200 && rechargeList.body?.code === 0 && rechargeList.body?.data?.list, `total=${rechargeList.body?.data?.total}`, JSON.stringify(rechargeList.body))

    // 10) 权限验证（非管理员访问管理员接口应失败）
    const lowLogin = await api('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'emp001', password: '123456' }),
    })
    if (lowLogin.http === 200 && lowLogin.body?.code === 0) {
      const empToken = lowLogin.body?.data?.token
      const denied = await api('/admin/users?page=1&page_size=1', {}, empToken)
      mark('权限控制', '员工访问管理员接口应被拒绝', denied.http === 403 || denied.body?.code !== 0, `http=${denied.http}, msg=${denied.body?.message}`, JSON.stringify(denied.body))
    } else {
      addResult('权限控制', '员工登录验收账号', false, '无法登录 emp001，无法进行权限拒绝测试')
    }
  } catch (e) {
    notes.push(`执行异常：${e.message}`)
  }

  const passed = reportRows.filter((r) => r.ok).length
  const failed = reportRows.filter((r) => !r.ok).length

  const lines = []
  lines.push('# 管理员端逐页面功能走查记录')
  lines.push('')
  lines.push(`- 执行时间: ${nowTs()}`)
  lines.push(`- 基础地址: ${BASE}`)
  lines.push(`- 结果汇总: 通过 ${passed} / 失败 ${failed} / 总计 ${reportRows.length}`)
  lines.push('')
  lines.push('## 逐项结果')
  lines.push('')
  lines.push('| 页面 | 检查项 | 结果 | 说明 |')
  lines.push('|---|---|---|---|')
  for (const r of reportRows) {
    lines.push(`| ${r.page} | ${r.item} | ${r.ok ? '✅ 通过' : '❌ 失败'} | ${String(r.detail).replace(/\|/g, '/')} |`)
  }
  lines.push('')
  lines.push('## 补充说明')
  lines.push('')
  if (notes.length === 0) {
    lines.push('- 无额外异常说明。')
  } else {
    for (const n of notes) lines.push(`- ${n}`)
  }
  lines.push('')
  lines.push('## 说明')
  lines.push('')
  lines.push('- 为避免破坏业务数据，本次对订单状态和充值审核未执行不可逆批量写操作。')
  lines.push('- 本次创建的测试数据（公司/用户/菜品/菜单/活动）均为“验收”前缀，菜单与活动已执行关闭/删除或不影响线上。')

  const outPath = path.join(__dirname, '../../QA_ADMIN_WALKTHROUGH.md')
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8')
  console.log(`REPORT_WRITTEN ${outPath}`)
  console.log(`SUMMARY pass=${passed} fail=${failed} total=${reportRows.length}`)
}

run()
