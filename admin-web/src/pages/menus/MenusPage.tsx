import { useState, useEffect, useMemo } from 'react'
import {
  Table, Button, Tag, Modal, DatePicker, Space, message, App,
  Transfer, Descriptions, Select, Input, Typography, Tooltip, Dropdown, Popconfirm,
  TimePicker,
} from 'antd'
import type { MenuProps } from 'antd'
import {
  PlusOutlined, ReloadOutlined,
  CheckCircleOutlined, StopOutlined, DeleteOutlined,
  EditOutlined, EyeOutlined, MoreOutlined, PlayCircleOutlined, InfoCircleOutlined,
} from '@ant-design/icons'
import PageListShell, { standardTablePagination } from '../../components/PageListShell'
import { tableListLocale, TableLoadErrorAlert } from '../../utils/tableListLocale'
import { filterBarRowStyle, filterBarCellStyle, filterBarLabelStyle } from '../../utils/filterToolbarLayout'
import { menusApi } from '../../api/menus'
import { dishesApi } from '../../api/dishes'
import { textFilterDropdown } from '../../utils/tableColumnFilters'
import dayjs, { Dayjs } from 'dayjs'

const { Text } = Typography

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'default' },
  published: { label: '已发布', color: 'green' },
  closed: { label: '已关闭', color: 'red' },
}

const MEAL_TYPE_MAP: Record<string, { label: string; color: string }> = {
  breakfast: { label: '早餐', color: 'gold' },
  lunch: { label: '午餐', color: 'blue' },
}

const OVERRIDE_OPTIONS = [
  { value: 'auto', label: '自动（按时段）' },
  { value: 'open', label: '强制开启' },
  { value: 'closed', label: '强制关闭' },
]

function timeStrToDayjs(t: string | null | undefined): Dayjs | null {
  if (t == null || t === '') return null
  const m = String(t).match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (!m) return null
  const h = m[1].padStart(2, '0')
  const mi = m[2]
  return dayjs(`2000-01-01 ${h}:${mi}`, 'YYYY-MM-DD HH:mm')
}

function fmtSubmitTime(d: Dayjs | null) {
  return d && d.isValid() ? d.format('HH:mm') : null
}

export default function MenusPage() {
  const { modal } = App.useApp()

  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(null)
  const [allDishes, setAllDishes] = useState<any[]>([])
  const [breakfastDishIds, setBreakfastDishIds] = useState<string[]>([])
  const [lunchDishIds, setLunchDishIds] = useState<string[]>([])
  const [editingMenuId, setEditingMenuId] = useState<number | null>(null)
  const [editingStatus, setEditingStatus] = useState<string>('draft')
  const [detailModal, setDetailModal] = useState<any>(null)

  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([])
  const [batchLoading, setBatchLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [menuModalSubmitting, setMenuModalSubmitting] = useState(false)

  const [globalOrdering, setGlobalOrdering] = useState<any>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsSubmitting, setSettingsSubmitting] = useState(false)
  const [gBfStart, setGBfStart] = useState<Dayjs | null>(null)
  const [gBfEnd, setGBfEnd] = useState<Dayjs | null>(null)
  const [gLuStart, setGLuStart] = useState<Dayjs | null>(null)
  const [gLuEnd, setGLuEnd] = useState<Dayjs | null>(null)

  const [bfOrdStart, setBfOrdStart] = useState<Dayjs | null>(null)
  const [bfOrdEnd, setBfOrdEnd] = useState<Dayjs | null>(null)
  const [luOrdStart, setLuOrdStart] = useState<Dayjs | null>(null)
  const [luOrdEnd, setLuOrdEnd] = useState<Dayjs | null>(null)
  const [bfOverride, setBfOverride] = useState<string>('auto')
  const [luOverride, setLuOverride] = useState<string>('auto')

  const [colMenuDate, setColMenuDate] = useState<string | undefined>()
  const [colStatus, setColStatus] = useState<string | undefined>()
  const [colCreator, setColCreator] = useState<string | undefined>()

  const fetchData = async (p = page, ps = pageSize) => {
    setLoading(true)
    setSelectedRowKeys([])
    setLoadError(false)
    try {
      const res: any = await menusApi.getList({
        page: p,
        page_size: ps,
        status: colStatus,
        menu_date: colMenuDate,
        creator_keyword: colCreator,
      })
      setData(res.data.list)
      setTotal(res.data.total)
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  const fetchAllDishes = async () => {
    const res: any = await dishesApi.getList({ is_available: 1, page_size: 200 })
    setAllDishes(res.data.list)
  }

  const loadGlobalOrdering = async () => {
    try {
      const res: any = await menusApi.getOrderingDefaults()
      setGlobalOrdering(res.data)
    } catch {
      /* 已由 request 提示 */
    }
  }

  useEffect(() => {
    fetchAllDishes()
    loadGlobalOrdering()
  }, [])

  useEffect(() => {
    fetchData(page, pageSize)
  }, [page, pageSize, colStatus, colMenuDate, colCreator])

  const openCreate = () => {
    setEditingMenuId(null)
    setEditingStatus('draft')
    setSelectedDate(dayjs())
    setBreakfastDishIds([])
    setLunchDishIds([])
    setBfOrdStart(null)
    setBfOrdEnd(null)
    setLuOrdStart(null)
    setLuOrdEnd(null)
    setBfOverride('auto')
    setLuOverride('auto')
    setModalOpen(true)
  }

  const menuDateKey = (record: any) => dayjs(record.menu_date).format('YYYY-MM-DD')

  const openEdit = async (record: any) => {
    try {
      const res: any = await menusApi.getByDate(menuDateKey(record))
      if (!res.data) {
        message.warning(res.message || '该日暂无菜单')
        return
      }
      setEditingMenuId(record.id)
      setEditingStatus(record.status || 'draft')
      setSelectedDate(dayjs(record.menu_date))
      const dishes = res.data.dishes || []
      setBreakfastDishIds(
        dishes.filter((d: any) => d.meal_type === 'breakfast').map((d: any) => String(d.id))
      )
      setLunchDishIds(
        dishes.filter((d: any) => !d.meal_type || d.meal_type === 'lunch').map((d: any) => String(d.id))
      )
      setBfOrdStart(timeStrToDayjs(res.data.breakfast_order_start))
      setBfOrdEnd(timeStrToDayjs(res.data.breakfast_order_end))
      setLuOrdStart(timeStrToDayjs(res.data.lunch_order_start))
      setLuOrdEnd(timeStrToDayjs(res.data.lunch_order_end))
      setBfOverride(res.data.breakfast_ordering_override || 'auto')
      setLuOverride(res.data.lunch_ordering_override || 'auto')
      setModalOpen(true)
    } catch {
      /* 错误已由 request 拦截器提示 */
    }
  }

  const handleSubmit = async () => {
    if (!selectedDate) return message.error('请选择日期')
    if (breakfastDishIds.length + lunchDishIds.length === 0) {
      return message.error('请至少为早餐或午餐选择一道菜品')
    }
    setMenuModalSubmitting(true)
    try {
      await menusApi.createOrUpdate({
        menu_date: selectedDate.format('YYYY-MM-DD'),
        breakfast_dish_ids: breakfastDishIds.map(Number),
        lunch_dish_ids: lunchDishIds.map(Number),
        status: editingMenuId === null ? 'draft' : editingStatus,
        breakfast_order_start: fmtSubmitTime(bfOrdStart),
        breakfast_order_end: fmtSubmitTime(bfOrdEnd),
        lunch_order_start: fmtSubmitTime(luOrdStart),
        lunch_order_end: fmtSubmitTime(luOrdEnd),
        breakfast_ordering_override: bfOverride,
        lunch_ordering_override: luOverride,
      })
      message.success('菜单保存成功')
      setModalOpen(false)
      fetchData(page, pageSize)
    } catch { /* 统一处理 */ }
    finally {
      setMenuModalSubmitting(false)
    }
  }

  const handleStatusChange = async (id: number, status: string) => {
    try {
      await menusApi.updateStatus(id, status)
      message.success('状态更新成功')
      fetchData(page, pageSize)
    } catch { /* 统一处理 */ }
  }

  const handleDelete = async (id: number) => {
    try {
      await menusApi.delete(id)
      message.success('菜单已删除')
      fetchData(page, pageSize)
    } catch { /* 统一处理 */ }
  }

  const openGlobalSettings = async () => {
    let g = globalOrdering
    if (!g) {
      try {
        const res: any = await menusApi.getOrderingDefaults()
        g = res.data
        setGlobalOrdering(g)
      } catch {
        return
      }
    }
    if (g) {
      setGBfStart(timeStrToDayjs(g.breakfast_order_start))
      setGBfEnd(timeStrToDayjs(g.breakfast_order_end))
      setGLuStart(timeStrToDayjs(g.lunch_order_start))
      setGLuEnd(timeStrToDayjs(g.lunch_order_end))
    }
    setSettingsOpen(true)
  }

  const handleSaveGlobalOrdering = async () => {
    if (!gBfStart?.isValid() || !gBfEnd?.isValid() || !gLuStart?.isValid() || !gLuEnd?.isValid()) {
      message.error('请填写完整的四个订餐时段')
      return
    }
    setSettingsSubmitting(true)
    try {
      const res: any = await menusApi.updateOrderingDefaults({
        breakfast_order_start: fmtSubmitTime(gBfStart),
        breakfast_order_end: fmtSubmitTime(gBfEnd),
        lunch_order_start: fmtSubmitTime(gLuStart),
        lunch_order_end: fmtSubmitTime(gLuEnd),
      })
      setGlobalOrdering(res.data)
      message.success(res.message || '已保存')
      setSettingsOpen(false)
    } finally {
      setSettingsSubmitting(false)
    }
  }

  /** 批量发布（草稿或已关闭可再次发布） */
  const handleBatchPublish = () => {
    const targets = data.filter(
      r => selectedRowKeys.includes(r.id) && (r.status === 'draft' || r.status === 'closed')
    )
    if (!targets.length) {
      message.warning('所选菜单中没有可发布的项（仅草稿或已关闭可发布）')
      return
    }
    modal.confirm({
      title: `确认发布选中的 ${targets.length} 个菜单？`,
      content: '员工端将显示该日菜单；能否下单以订餐时段为准。',
      okText: '确认发布',
      cancelText: '取消',
      onOk: async () => {
        setBatchLoading(true)
        try {
          await Promise.all(targets.map(r => menusApi.updateStatus(r.id, 'published')))
          message.success(`已发布 ${targets.length} 个菜单`)
          setSelectedRowKeys([])
          fetchData(page, pageSize)
        } finally { setBatchLoading(false) }
      },
    })
  }

  /** 批量关闭（仅对已发布生效） */
  const handleBatchClose = () => {
    const targets = data.filter(r => selectedRowKeys.includes(r.id) && r.status === 'published')
    if (!targets.length) {
      message.warning('所选菜单中没有可关闭的已发布菜单')
      return
    }
    modal.confirm({
      title: `确认关闭选中的 ${targets.length} 个已发布菜单？`,
      content: '员工端将隐藏该日菜单；订餐时段设置不变。',
      okText: '确认关闭',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        setBatchLoading(true)
        try {
          await Promise.all(targets.map(r => menusApi.updateStatus(r.id, 'closed')))
          message.success(`已关闭 ${targets.length} 个菜单`)
          setSelectedRowKeys([])
          fetchData(page, pageSize)
        } finally { setBatchLoading(false) }
      },
    })
  }

  /** 批量删除 */
  const handleBatchDelete = () => {
    modal.confirm({
      title: `确认删除选中的 ${selectedRowKeys.length} 个菜单？`,
      content: '已有有效订单的菜单无法删除，其余将被永久移除',
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        setBatchLoading(true)
        let successCount = 0
        const failList: string[] = []
        try {
          await Promise.all(
            selectedRowKeys.map(id =>
              menusApi.delete(id)
                .then(() => { successCount++ })
                .catch((e: any) => {
                  const dateStr = data.find(r => r.id === id)?.menu_date ?? String(id)
                  failList.push(`${dayjs(dateStr).format('MM-DD')}：${e?.response?.data?.message ?? '删除失败'}`)
                })
            )
          )
          if (successCount) message.success(`已删除 ${successCount} 个菜单`)
          if (failList.length) message.warning(`${failList.length} 个菜单无法删除：${failList.join('；')}`)
          setSelectedRowKeys([])
          fetchData(page, pageSize)
        } finally { setBatchLoading(false) }
      },
    })
  }

  const openDetail = async (record: any) => {
    try {
      const res: any = await menusApi.getByDate(menuDateKey(record))
      if (!res.data) {
        message.warning(res.message || '该日暂无菜单')
        return
      }
      setDetailModal(res.data)
    } catch {
      /* 错误已由 request 拦截器提示 */
    }
  }

  const [listFilterKey, setListFilterKey] = useState(0)

  const resetListFilters = () => {
    setColMenuDate(undefined)
    setColStatus(undefined)
    setColCreator(undefined)
    setPage(1)
    setListFilterKey(k => k + 1)
  }

  const statusFilters = useMemo(
    () => Object.entries(STATUS_MAP).map(([value, { label }]) => ({ text: label, value })),
    []
  )

  const detailDishColumns = useMemo(
    () => [
      {
        title: '餐次',
        dataIndex: 'meal_type',
        align: 'center' as const,
        width: 88,
        filters: [
          { text: '早餐', value: 'breakfast' },
          { text: '午餐', value: 'lunch' },
        ],
        onFilter: (v: any, r: any) => (r.meal_type || 'lunch') === v,
        render: (v: string) => {
          const m = MEAL_TYPE_MAP[v || 'lunch']
          return <Tag color={m?.color}>{m?.label}</Tag>
        },
      },
      {
        title: '菜品',
        dataIndex: 'name',
        align: 'left' as const,
        filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
          <div style={{ padding: 8 }}>
            <Input
              placeholder="筛选菜品名"
              value={selectedKeys[0]}
              onChange={e => setSelectedKeys(e.target.value ? [e.target.value] : [])}
              onPressEnter={() => confirm()}
              style={{ marginBottom: 8, display: 'block' }}
            />
            <Space>
              <Button type="primary" size="small" onClick={() => confirm()}>搜索</Button>
              <Button size="small" onClick={() => { clearFilters?.(); confirm() }}>重置</Button>
            </Space>
          </div>
        ),
        onFilter: (value: any, record: any) =>
          String(record.name).toLowerCase().includes(String(value).toLowerCase()),
      },
      {
        title: '分类',
        dataIndex: 'category',
        align: 'center' as const,
        filters: [...new Set((detailModal?.dishes || []).map((d: any) => d.category).filter(Boolean))].map((c) => ({
          text: String(c),
          value: String(c),
        })),
        onFilter: (v: any, r: any) => r.category === v,
        render: (v: string) => <Tag>{v}</Tag>,
      },
      {
        title: '价格',
        dataIndex: 'price',
        align: 'right' as const,
        sorter: (a: any, b: any) => Number(a.price) - Number(b.price),
        showSorterTooltip: { title: '按价格排序' },
        render: (v: number) => `¥${Number(v).toFixed(2)}`,
      },
      {
        title: '限量',
        dataIndex: 'stock',
        align: 'right' as const,
        filters: [
          { text: '不限', value: 'unlimited' },
          { text: '有限', value: 'limited' },
        ],
        onFilter: (v: any, r: any) =>
          v === 'unlimited' ? r.stock == null : v === 'limited' ? r.stock != null : true,
        render: (v: number) => (v == null ? '不限' : v),
      },
    ],
    [detailModal]
  )

  const mealColumnRender = (text: string) => {
    const s = (text || '').trim()
    if (!s) {
      return <Text type="secondary">—</Text>
    }
    return (
      <Tooltip title={s} placement="topLeft">
        <span style={{ cursor: 'default' }}>{s}</span>
      </Tooltip>
    )
  }

  /** 列表列宽（px）：日期/状态较窄，两餐菜品均分主体宽度，创建人适中，操作列固定 */
  const COL_W = {
    date: 132,
    status: 84,
    breakfast: 280,
    lunch: 280,
    creator: 112,
    actions: 168,
  } as const
  const TABLE_SCROLL_X =
    COL_W.date + COL_W.status + COL_W.breakfast + COL_W.lunch + COL_W.creator + COL_W.actions

  const columns = [
    {
      title: '日期',
      dataIndex: 'menu_date',
      align: 'left' as const,
      width: COL_W.date,
      filteredValue: colMenuDate ? [colMenuDate] : null,
      filterDropdown: ({ confirm, clearFilters }: any) => (
        <div style={{ padding: 8 }}>
          <DatePicker
            style={{ width: '100%', marginBottom: 8 }}
            value={colMenuDate ? dayjs(colMenuDate) : null}
            onChange={(d) => setColMenuDate(d ? d.format('YYYY-MM-DD') : undefined)}
            allowClear
          />
          <Space>
            <Button type="primary" size="small" onClick={() => { setPage(1); confirm() }}>确定</Button>
            <Button size="small" onClick={() => { setColMenuDate(undefined); clearFilters?.(); setPage(1); confirm() }}>重置</Button>
          </Space>
        </div>
      ),
      render: (v: string) => dayjs(v).format('YYYY-MM-DD (ddd)'),
    },
    {
      title: '状态',
      dataIndex: 'status',
      align: 'left' as const,
      width: COL_W.status,
      filteredValue: colStatus ? [colStatus] : null,
      filterDropdown: ({ confirm, clearFilters }: any) => (
        <div style={{ padding: 8 }}>
          <Select
            allowClear
            placeholder="选择状态"
            style={{ width: '100%', marginBottom: 8 }}
            value={colStatus}
            onChange={setColStatus}
            options={statusFilters.map(f => ({ label: f.text, value: f.value }))}
          />
          <Space>
            <Button type="primary" size="small" onClick={() => { setPage(1); confirm() }}>确定</Button>
            <Button size="small" onClick={() => { setColStatus(undefined); clearFilters?.(); setPage(1); confirm() }}>重置</Button>
          </Space>
        </div>
      ),
      render: (v: string) => <Tag color={STATUS_MAP[v]?.color}>{STATUS_MAP[v]?.label}</Tag>,
    },
    {
      title: '早餐菜品',
      dataIndex: 'breakfast_dishes',
      align: 'left' as const,
      ellipsis: { showTitle: false },
      width: COL_W.breakfast,
      render: (_: unknown, record: any) => mealColumnRender(record.breakfast_dishes),
    },
    {
      title: '午餐菜品',
      dataIndex: 'lunch_dishes',
      align: 'left' as const,
      ellipsis: { showTitle: false },
      width: COL_W.lunch,
      render: (_: unknown, record: any) => mealColumnRender(record.lunch_dishes),
    },
    {
      title: '创建人',
      dataIndex: 'creator_name',
      align: 'left' as const,
      width: COL_W.creator,
      ellipsis: true,
      filteredValue: colCreator ? [colCreator] : null,
      filterDropdown: textFilterDropdown('搜索创建人', (v) => { setColCreator(v); setPage(1) }),
      render: (v: string) => v || '-',
    },
    {
      title: '操作',
      key: 'actions',
      align: 'center' as const,
      width: COL_W.actions,
      fixed: 'right' as const,
      render: (_: any, record: any) => {
        const confirmDelete = () => {
          modal.confirm({
            title: '确认删除该日菜单？',
            content: '已有有效订单的菜单无法删除',
            okText: '删除',
            okType: 'danger',
            cancelText: '取消',
            onOk: () => handleDelete(record.id),
          })
        }
        const moreItems: MenuProps['items'] = [
          {
            key: 'view',
            icon: <EyeOutlined />,
            label: '查看详情',
            onClick: () => openDetail(record),
          },
          { type: 'divider' },
          {
            key: 'delete',
            icon: <DeleteOutlined style={{ color: '#ff4d4f' }} />,
            label: <span style={{ color: '#ff4d4f' }}>删除</span>,
            onClick: confirmDelete,
          },
        ]
        return (
          <Space size={4} style={{ justifyContent: 'flex-start', width: '100%' }}>
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => openEdit(record)}
            >
              编辑
            </Button>
            {record.status === 'draft' && (
              <Popconfirm
                title="确认发布该日菜单？"
                description="员工可见菜单；能否下单以订餐时段为准。"
                onConfirm={() => handleStatusChange(record.id, 'published')}
                okText="发布"
                cancelText="取消"
              >
                <Button size="small" type="primary" ghost icon={<CheckCircleOutlined />}>
                  发布
                </Button>
              </Popconfirm>
            )}
            {record.status === 'closed' && (
              <Popconfirm
                title="确认重新发布该日菜单？"
                description="员工可见菜单；能否下单以订餐时段为准。"
                onConfirm={() => handleStatusChange(record.id, 'published')}
                okText="发布"
                cancelText="取消"
              >
                <Button size="small" type="primary" ghost icon={<PlayCircleOutlined />}>
                  重新发布
                </Button>
              </Popconfirm>
            )}
            {record.status === 'published' && (
              <Tooltip title="仅隐藏该日菜单；下单仍看订餐时段。">
                <Button
                  size="small"
                  icon={<StopOutlined />}
                  onClick={() => handleStatusChange(record.id, 'closed')}
                >
                  关闭
                </Button>
              </Tooltip>
            )}
            <Dropdown menu={{ items: moreItems }} trigger={['click']} placement="bottomRight">
              <Button size="small" type="text" icon={<MoreOutlined />} />
            </Dropdown>
          </Space>
        )
      },
    },
  ]

  const transferDataSource = allDishes.map(d => ({
    key: String(d.id),
    title: `${d.name} ¥${Number(d.price).toFixed(2)}`,
    description: d.category,
  }))

  return (
    <div>
      <PageListShell
        title="菜单管理"
        headerExtra={
          <Space>
            {selectedRowKeys.length > 0 && (
              <>
                <Text type="secondary">
                  已选 <Text strong style={{ color: '#1677ff' }}>{selectedRowKeys.length}</Text> 项
                </Text>
                <Button
                  icon={<CheckCircleOutlined />}
                  loading={batchLoading}
                  onClick={handleBatchPublish}
                >批量发布</Button>
                <Button
                  icon={<StopOutlined />}
                  loading={batchLoading}
                  onClick={handleBatchClose}
                >批量关闭</Button>
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  loading={batchLoading}
                  onClick={handleBatchDelete}
                >批量删除</Button>
              </>
            )}
            <Button onClick={openGlobalSettings}>全局订餐时段</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增菜单</Button>
          </Space>
        }
        filterBar={
          <div style={filterBarRowStyle}>
            <div style={filterBarCellStyle(150)}>
              <Text type="secondary" style={filterBarLabelStyle}>菜单日期</Text>
              <DatePicker
                allowClear
                placeholder="选择日期"
                value={colMenuDate ? dayjs(colMenuDate) : null}
                onChange={(d) => { setColMenuDate(d ? d.format('YYYY-MM-DD') : undefined); setPage(1) }}
                style={{ flex: 1, minWidth: 120, maxWidth: '100%' }}
              />
            </div>
            <div style={filterBarCellStyle(130)}>
              <Text type="secondary" style={filterBarLabelStyle}>状态</Text>
              <Select
                allowClear
                placeholder="全部状态"
                style={{ flex: 1, minWidth: 96, maxWidth: '100%' }}
                value={colStatus}
                onChange={(v) => { setColStatus(v); setPage(1) }}
                options={statusFilters.map(f => ({ label: f.text, value: f.value }))}
              />
            </div>
            <div style={filterBarCellStyle(200)}>
              <Text type="secondary" style={filterBarLabelStyle}>创建人</Text>
              <Input.Search
                key={listFilterKey}
                allowClear
                placeholder="昵称或用户名"
                style={{ flex: 1, minWidth: 0, maxWidth: '100%' }}
                defaultValue={colCreator}
                onSearch={(v) => { setColCreator(v || undefined); setPage(1) }}
              />
            </div>
            <div style={filterBarCellStyle(180, 'flex-end')}>
              <Button onClick={resetListFilters}>重置筛选</Button>
              <Button icon={<ReloadOutlined />} onClick={() => fetchData(page, pageSize)}>刷新</Button>
            </div>
          </div>
        }
      >
        <div
          style={{
            marginBottom: 10,
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid #bae0ff',
            background: '#e6f4ff',
            color: '#0958d9',
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          <InfoCircleOutlined style={{ marginRight: 6 }} />
          厨师可以提前把未来一周菜单保存为草稿；系统会在菜单当天自动发布，第二天自动关闭。需要临时停用时，点“关闭”即可。
        </div>
        <TableLoadErrorAlert error={loadError} onRetry={() => fetchData(page, pageSize)} />
        <Table
          rowKey="id"
          size="middle"
          tableLayout="fixed"
          scroll={{ x: TABLE_SCROLL_X }}
          dataSource={data}
          columns={columns}
          loading={loading}
          locale={tableListLocale}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys as number[]),
          }}
          pagination={standardTablePagination({
            current: page,
            total,
            pageSize,
            onChange: (p, ps) => { setPage(p); setPageSize(ps) },
          })}
        />
      </PageListShell>

      <Modal
        title="全局默认订餐时段"
        open={settingsOpen}
        destroyOnClose
        onOk={handleSaveGlobalOrdering}
        onCancel={() => setSettingsOpen(false)}
        confirmLoading={settingsSubmitting}
        okText="保存"
        width={520}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Text type="secondary">
            未在「按日菜单」里单独填写的时间，将使用此处默认值；按日可覆盖或设置强制开/关。
          </Text>
          <div>
            <Text strong style={{ marginRight: 12 }}>早餐</Text>
            <TimePicker value={gBfStart} onChange={setGBfStart} format="HH:mm" needConfirm={false} minuteStep={5} />
            <Text type="secondary" style={{ margin: '0 8px' }}>至</Text>
            <TimePicker value={gBfEnd} onChange={setGBfEnd} format="HH:mm" needConfirm={false} minuteStep={5} />
          </div>
          <div>
            <Text strong style={{ marginRight: 12 }}>午餐</Text>
            <TimePicker value={gLuStart} onChange={setGLuStart} format="HH:mm" needConfirm={false} minuteStep={5} />
            <Text type="secondary" style={{ margin: '0 8px' }}>至</Text>
            <TimePicker value={gLuEnd} onChange={setGLuEnd} format="HH:mm" needConfirm={false} minuteStep={5} />
          </div>
        </Space>
      </Modal>

      <Modal
        title={editingMenuId ? '编辑菜单' : '新建菜单'}
        open={modalOpen}
        destroyOnClose
        width={760}
        wrapClassName="menu-modal-soft-scroll"
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText="保存"
        confirmLoading={menuModalSubmitting}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <span style={{ marginRight: 8 }}>菜单日期：</span>
            <DatePicker value={selectedDate} onChange={setSelectedDate}
              disabledDate={d => d < dayjs().startOf('day')} />
          </div>
          <div style={{ paddingTop: 8, borderTop: '1px solid #f0f0f0' }}>
            <Text strong>该日订餐时段</Text>
            <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
              留空则沿用全局
              {globalOrdering && (
                <>
                  {' '}
                  （早 {String(globalOrdering.breakfast_order_start ?? '').slice(0, 5)}–{String(globalOrdering.breakfast_order_end ?? '').slice(0, 5)}，
                  午 {String(globalOrdering.lunch_order_start ?? '').slice(0, 5)}–{String(globalOrdering.lunch_order_end ?? '').slice(0, 5)}）
                </>
              )}
            </Text>
            <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <Text style={{ width: 40 }}>早餐</Text>
              <TimePicker allowClear value={bfOrdStart} onChange={setBfOrdStart} format="HH:mm" needConfirm={false} minuteStep={5} placeholder="开始" />
              <Text type="secondary">至</Text>
              <TimePicker allowClear value={bfOrdEnd} onChange={setBfOrdEnd} format="HH:mm" needConfirm={false} minuteStep={5} placeholder="结束" />
              <Select style={{ width: 150 }} value={bfOverride} onChange={setBfOverride} options={OVERRIDE_OPTIONS} />
            </div>
            <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <Text style={{ width: 40 }}>午餐</Text>
              <TimePicker allowClear value={luOrdStart} onChange={setLuOrdStart} format="HH:mm" needConfirm={false} minuteStep={5} placeholder="开始" />
              <Text type="secondary">至</Text>
              <TimePicker allowClear value={luOrdEnd} onChange={setLuOrdEnd} format="HH:mm" needConfirm={false} minuteStep={5} placeholder="结束" />
              <Select style={{ width: 150 }} value={luOverride} onChange={setLuOverride} options={OVERRIDE_OPTIONS} />
            </div>
          </div>
          <div>
            <div style={{ marginBottom: 8 }}>
              <Text strong>早餐</Text>
              <Text type="secondary" style={{ marginLeft: 8 }}>已选 {breakfastDishIds.length} 道</Text>
            </div>
            <Transfer
              dataSource={transferDataSource}
              targetKeys={breakfastDishIds}
              onChange={(keys) => setBreakfastDishIds(keys as string[])}
              render={(item) => item.title}
              titles={['菜品库', '早餐供应']}
              listStyle={{ width: 300, height: 280 }}
              showSearch
            />
          </div>
          <div>
            <div style={{ marginBottom: 8 }}>
              <Text strong>午餐</Text>
              <Text type="secondary" style={{ marginLeft: 8 }}>已选 {lunchDishIds.length} 道</Text>
            </div>
            <Transfer
              dataSource={transferDataSource}
              targetKeys={lunchDishIds}
              onChange={(keys) => setLunchDishIds(keys as string[])}
              render={(item) => item.title}
              titles={['菜品库', '午餐供应']}
              listStyle={{ width: 300, height: 280 }}
              showSearch
            />
          </div>
        </Space>
      </Modal>

      <Modal
        title="菜单详情"
        open={!!detailModal}
        destroyOnClose
        onCancel={() => setDetailModal(null)}
        footer={null}
        width={760}
      >
        {detailModal && (
          <>
            <Descriptions
              column={2}
              bordered
              labelStyle={{ color: '#64748B', fontWeight: 500, width: 72, whiteSpace: 'nowrap' }}
              contentStyle={{ color: '#0F172A' }}
              style={{ marginBottom: 20 }}
            >
              <Descriptions.Item label="日期">
                {dayjs(detailModal.menu_date).format('YYYY-MM-DD (ddd)')}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={STATUS_MAP[detailModal.status]?.color}>
                  {STATUS_MAP[detailModal.status]?.label}
                </Tag>
              </Descriptions.Item>
              {detailModal.ordering && (
                <>
                  <Descriptions.Item label="早餐订餐" span={2}>
                    <Space wrap size="small">
                      <Tag color={detailModal.ordering.breakfast.accepting ? 'green' : 'default'}>
                        {detailModal.ordering.breakfast.accepting ? '当前可订' : '当前不可订'}
                      </Tag>
                      {!!detailModal.ordering.breakfast.window && (
                        <Text type="secondary">时段 {detailModal.ordering.breakfast.window}</Text>
                      )}
                      <Text type="secondary">
                        策略：{OVERRIDE_OPTIONS.find(o => o.value === detailModal.breakfast_ordering_override)?.label ?? '自动'}
                      </Text>
                      {(detailModal.breakfast_order_start != null || detailModal.breakfast_order_end != null) && (
                        <Text>
                          按日时间：{String(detailModal.breakfast_order_start ?? '').slice(0, 5) || '—'}
                          –{String(detailModal.breakfast_order_end ?? '').slice(0, 5) || '—'}
                        </Text>
                      )}
                      {!!detailModal.ordering.breakfast.message && (
                        <Text type="warning">{detailModal.ordering.breakfast.message}</Text>
                      )}
                    </Space>
                  </Descriptions.Item>
                  <Descriptions.Item label="午餐订餐" span={2}>
                    <Space wrap size="small">
                      <Tag color={detailModal.ordering.lunch.accepting ? 'green' : 'default'}>
                        {detailModal.ordering.lunch.accepting ? '当前可订' : '当前不可订'}
                      </Tag>
                      {!!detailModal.ordering.lunch.window && (
                        <Text type="secondary">时段 {detailModal.ordering.lunch.window}</Text>
                      )}
                      <Text type="secondary">
                        策略：{OVERRIDE_OPTIONS.find(o => o.value === detailModal.lunch_ordering_override)?.label ?? '自动'}
                      </Text>
                      {(detailModal.lunch_order_start != null || detailModal.lunch_order_end != null) && (
                        <Text>
                          按日时间：{String(detailModal.lunch_order_start ?? '').slice(0, 5) || '—'}
                          –{String(detailModal.lunch_order_end ?? '').slice(0, 5) || '—'}
                        </Text>
                      )}
                      {!!detailModal.ordering.lunch.message && (
                        <Text type="warning">{detailModal.ordering.lunch.message}</Text>
                      )}
                    </Space>
                  </Descriptions.Item>
                </>
              )}
            </Descriptions>
            <Table
              size="small"
              style={{ marginTop: 0 }}
              locale={tableListLocale}
              dataSource={detailModal.dishes || []}
              rowKey={(r: any) => String(r.menu_dish_id ?? `${r.id}-${r.meal_type || 'lunch'}`)}
              pagination={false}
              scroll={{ x: 600 }}
              columns={detailDishColumns}
            />
          </>
        )}
      </Modal>
    </div>
  )
}
