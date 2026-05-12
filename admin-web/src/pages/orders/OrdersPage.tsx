import { useState, useEffect } from 'react'
import { Table, Tag, Select, DatePicker, Space, Typography, Button, Modal, Descriptions, Input, App, message } from 'antd'
import { ReloadOutlined, CheckCircleOutlined, StopOutlined } from '@ant-design/icons'
import PageListShell, { standardTablePagination } from '../../components/PageListShell'
import { textFilterDropdown } from '../../utils/tableColumnFilters'
import { ordersApi } from '../../api/orders'
import dayjs from 'dayjs'

const { Text } = Typography
const { Option } = Select

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: '待接单', color: 'gold' },
  confirmed: { label: '制作中', color: 'blue' },
  ready: { label: '可取餐', color: 'cyan' },
  done: { label: '已完成', color: 'green' },
  cancelled: { label: '已取消', color: 'default' },
}

export default function OrdersPage() {
  const { modal } = App.useApp()

  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [filterStatus, setFilterStatus] = useState<string>()
  const [filterDate, setFilterDate] = useState<string>(dayjs().format('YYYY-MM-DD'))
  const [detailOrder, setDetailOrder] = useState<any>(null)

  const [colOrderNo, setColOrderNo] = useState<string | undefined>()
  const [colUserName, setColUserName] = useState<string | undefined>()
  const [colCompanyName, setColCompanyName] = useState<string | undefined>()
  const [ordersListFilterKey, setOrdersListFilterKey] = useState(0)
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([])
  const [batchLoading, setBatchLoading] = useState(false)

  const resetOrderFilters = () => {
    setFilterStatus(undefined)
    setFilterDate('')
    setColOrderNo(undefined)
    setColUserName(undefined)
    setColCompanyName(undefined)
    setOrdersListFilterKey(k => k + 1)
    setPage(1)
  }

  const handleBatchConfirm = () => {
    const targets = data.filter(r => selectedRowKeys.includes(r.id) && r.status === 'pending')
    if (!targets.length) { message.warning('选中的订单中没有"待接单"状态的订单'); return }
    modal.confirm({
      title: `确认批量接单 ${targets.length} 笔订单？`,
      content: '订单状态将更新为"制作中"',
      okText: '确认接单',
      cancelText: '取消',
      onOk: async () => {
        setBatchLoading(true)
        let ok = 0
        try {
          await Promise.all(targets.map(r =>
            ordersApi.updateStatus(r.id, 'confirmed').then(() => { ok++ }).catch(() => {})
          ))
          message.success(`已接单 ${ok} 笔`)
          setSelectedRowKeys([])
          fetchData(page, pageSize)
        } finally { setBatchLoading(false) }
      },
    })
  }

  const handleBatchCancel = () => {
    const targets = data.filter(r => selectedRowKeys.includes(r.id) && r.status === 'pending')
    if (!targets.length) { message.warning('只有"待接单"状态的订单可以取消'); return }
    modal.confirm({
      title: `确认批量取消 ${targets.length} 笔订单？`,
      content: '取消后无法恢复，相关费用不会自动退款',
      okText: '确认取消',
      okButtonProps: { danger: true },
      cancelText: '不取消',
      onOk: async () => {
        setBatchLoading(true)
        let ok = 0
        try {
          await Promise.all(targets.map(r =>
            ordersApi.updateStatus(r.id, 'cancelled').then(() => { ok++ }).catch(() => {})
          ))
          message.success(`已取消 ${ok} 笔订单`)
          setSelectedRowKeys([])
          fetchData(page, pageSize)
        } finally { setBatchLoading(false) }
      },
    })
  }

  const fetchData = async (p = page, ps = pageSize) => {
    setLoading(true)
    setSelectedRowKeys([])
    try {
      const res: any = await ordersApi.getAll({
        page: p,
        page_size: ps,
        status: filterStatus,
        date: filterDate || undefined,
        order_no: colOrderNo,
        user_name: colUserName,
        company_name: colCompanyName,
      })
      setData(res.data.list)
      setTotal(res.data.total)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData(page, pageSize)
  }, [page, pageSize, filterStatus, filterDate, colOrderNo, colUserName, colCompanyName])

  const statusOptions = Object.entries(STATUS_MAP).map(([value, { label }]) => ({ label, value }))

  const columns = [
    {
      title: '订单号',
      dataIndex: 'order_no',
      width: 160,
      filteredValue: colOrderNo ? [colOrderNo] : null,
      filterDropdown: textFilterDropdown('搜索订单号', (v) => { setColOrderNo(v); setPage(1) }),
      render: (v: string) => <Text code style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: '用户',
      dataIndex: 'user_name',
      filteredValue: colUserName ? [colUserName] : null,
      filterDropdown: textFilterDropdown('搜索用户昵称', (v) => { setColUserName(v); setPage(1) }),
    },
    {
      title: '公司',
      dataIndex: 'company_name',
      filteredValue: colCompanyName ? [colCompanyName] : null,
      filterDropdown: textFilterDropdown('搜索公司名称', (v) => { setColCompanyName(v); setPage(1) }),
      render: (v: string) => v || '-',
    },
    {
      title: '金额',
      dataIndex: 'total_amount',
      align: 'right' as const,
      sorter: (a: any, b: any) => Number(a.total_amount) - Number(b.total_amount),
      render: (v: string) => <Text strong>¥{Number(v).toFixed(2)}</Text>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      filteredValue: filterStatus ? [filterStatus] : null,
      filterDropdown: ({ confirm, clearFilters }: any) => (
        <div style={{ padding: 8 }}>
          <Select
            allowClear
            placeholder="订单状态"
            style={{ width: '100%', marginBottom: 8 }}
            value={filterStatus}
            onChange={setFilterStatus}
            options={statusOptions}
          />
          <Space>
            <Button type="primary" size="small" onClick={() => { setPage(1); confirm() }}>确定</Button>
            <Button size="small" onClick={() => { setFilterStatus(undefined); clearFilters?.(); setPage(1); confirm() }}>重置</Button>
          </Space>
        </div>
      ),
      render: (v: string) => <Tag color={STATUS_MAP[v]?.color}>{STATUS_MAP[v]?.label}</Tag>,
    },
    {
      title: '下单时间',
      dataIndex: 'created_at',
      filteredValue: filterDate ? [filterDate] : null,
      filterDropdown: ({ confirm, clearFilters }: any) => (
        <div style={{ padding: 8 }}>
          <DatePicker
            style={{ width: '100%', marginBottom: 8 }}
            value={filterDate ? dayjs(filterDate) : null}
            onChange={(d) => setFilterDate(d ? d.format('YYYY-MM-DD') : '')}
            allowClear
          />
          <Space>
            <Button type="primary" size="small" onClick={() => { setPage(1); confirm() }}>确定</Button>
            <Button size="small" onClick={() => { setFilterDate(''); clearFilters?.(); setPage(1); confirm() }}>重置</Button>
          </Space>
        </div>
      ),
      sorter: (a: any, b: any) => dayjs(a.created_at).valueOf() - dayjs(b.created_at).valueOf(),
      render: (v: string) => dayjs(v).format('MM-DD HH:mm'),
    },
    {
      title: '操作', width: 88, align: 'left' as const,
      render: (_: any, record: any) => (
        <Button size="small" onClick={() => setDetailOrder(record)}>详情</Button>
      ),
    },
  ]

  return (
    <div>
      <PageListShell
        title="订单管理"
        filterLeft={
          <>
            <Text type="secondary" style={{ fontSize: 13 }}>状态</Text>
            <Select placeholder="全部" allowClear style={{ width: 120 }}
              value={filterStatus}
              onChange={(v) => { setFilterStatus(v); setPage(1) }}>
              {Object.entries(STATUS_MAP).map(([k, v]) => <Option key={k} value={k}>{v.label}</Option>)}
            </Select>
            <Text type="secondary" style={{ fontSize: 13 }}>下单日</Text>
            <DatePicker
              value={filterDate ? dayjs(filterDate) : null}
              onChange={(d) => { setFilterDate(d ? d.format('YYYY-MM-DD') : ''); setPage(1) }}
              placeholder="全部日期"
              allowClear
            />
            <Text type="secondary" style={{ fontSize: 13 }}>订单号</Text>
            <Input.Search key={`o-lk-${ordersListFilterKey}-no`} placeholder="模糊" allowClear style={{ width: 150 }}
              onSearch={(v) => { setColOrderNo(v || undefined); setPage(1) }} />
            <Text type="secondary" style={{ fontSize: 13 }}>用户</Text>
            <Input.Search key={`o-lk-${ordersListFilterKey}-user`} placeholder="昵称" allowClear style={{ width: 130 }}
              onSearch={(v) => { setColUserName(v || undefined); setPage(1) }} />
            <Text type="secondary" style={{ fontSize: 13 }}>公司</Text>
            <Input.Search key={`o-lk-${ordersListFilterKey}-co`} placeholder="名称" allowClear style={{ width: 140 }}
              onSearch={(v) => { setColCompanyName(v || undefined); setPage(1) }} />
          </>
        }
        headerExtra={
          selectedRowKeys.length > 0 ? (
            <Space>
              <Text type="secondary">
                已选 <Text strong style={{ color: '#1677ff' }}>{selectedRowKeys.length}</Text> 项
              </Text>
              <Button icon={<CheckCircleOutlined />} loading={batchLoading}
                onClick={handleBatchConfirm}>批量接单</Button>
              <Button danger icon={<StopOutlined />} loading={batchLoading}
                onClick={handleBatchCancel}>批量取消</Button>
            </Space>
          ) : undefined
        }
        filterRight={
          <>
            <Button onClick={resetOrderFilters}>重置筛选</Button>
            <Button icon={<ReloadOutlined />} onClick={() => fetchData(page, pageSize)}>刷新</Button>
          </>
        }
      >
        <Table
          rowKey="id"
          size="middle"
          dataSource={data}
          columns={columns}
          loading={loading}
          scroll={{ x: 1100 }}
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
        title="订单详情"
        open={!!detailOrder}
        onCancel={() => setDetailOrder(null)}
        footer={null}
        width={620}
      >
        {detailOrder && (
          <>
            <Descriptions
              column={2}
              bordered
              labelStyle={{ color: '#64748B', fontWeight: 500, width: 88, whiteSpace: 'nowrap' }}
              contentStyle={{ color: '#0F172A' }}
              style={{ marginBottom: 20 }}
            >
              <Descriptions.Item label="订单号" span={2}>
                <Text code style={{ fontSize: 13 }}>{detailOrder.order_no}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="用户">{detailOrder.user_name}</Descriptions.Item>
              <Descriptions.Item label="公司">{detailOrder.company_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={STATUS_MAP[detailOrder.status]?.color}>
                  {STATUS_MAP[detailOrder.status]?.label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="下单时间">
                {dayjs(detailOrder.created_at).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              {detailOrder.remark && (
                <Descriptions.Item label="备注" span={2}>{detailOrder.remark}</Descriptions.Item>
              )}
            </Descriptions>
            <Table size="small" style={{ marginTop: 0 }} pagination={false}
              dataSource={detailOrder.items || []} rowKey="id"
              columns={[
                {
                  title: '菜品',
                  dataIndex: 'dish_name',
                  filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
                    <div style={{ padding: 8 }}>
                      <Input placeholder="筛选菜品" value={selectedKeys[0]}
                        onChange={e => setSelectedKeys(e.target.value ? [e.target.value] : [])}
                        onPressEnter={() => confirm()}
                        style={{ marginBottom: 8, display: 'block' }} />
                      <Space>
                        <Button type="primary" size="small" onClick={() => confirm()}>搜索</Button>
                        <Button size="small" onClick={() => { clearFilters?.(); confirm() }}>重置</Button>
                      </Space>
                    </div>
                  ),
                  onFilter: (value: any, r: any) =>
                    !value || String(r.dish_name).toLowerCase().includes(String(value).toLowerCase()),
                },
                {
                  title: '单价',
                  dataIndex: 'dish_price',
                  sorter: (a: any, b: any) => Number(a.dish_price) - Number(b.dish_price),
                  render: (v: number) => `¥${Number(v).toFixed(2)}`,
                },
                {
                  title: '数量',
                  dataIndex: 'quantity',
                  filters: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => ({ text: `${n} 份`, value: n })),
                  onFilter: (value: any, r: any) => value == null || r.quantity === value,
                },
                {
                  title: '小计',
                  dataIndex: 'subtotal',
                  sorter: (a: any, b: any) => Number(a.subtotal) - Number(b.subtotal),
                  render: (v: number) => `¥${Number(v).toFixed(2)}`,
                },
              ]}
              summary={() => (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={3}><Text strong>合计</Text></Table.Summary.Cell>
                  <Table.Summary.Cell index={1}>
                    <Text strong style={{ color: '#f5a623' }}>¥{Number(detailOrder.total_amount).toFixed(2)}</Text>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              )}
            />
          </>
        )}
      </Modal>
    </div>
  )
}
