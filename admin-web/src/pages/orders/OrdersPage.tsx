import { useState, useEffect } from 'react'
import { Table, Tag, Select, DatePicker, Space, Typography, Button, Modal, Descriptions } from 'antd'
import { ordersApi } from '../../api/orders'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { Option } = Select
const { RangePicker } = DatePicker

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: '待接单', color: 'gold' },
  confirmed: { label: '制作中', color: 'blue' },
  ready: { label: '可取餐', color: 'cyan' },
  done: { label: '已完成', color: 'green' },
  cancelled: { label: '已取消', color: 'default' },
}

export default function OrdersPage() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [filterStatus, setFilterStatus] = useState<string>()
  const [filterDate, setFilterDate] = useState<string>(dayjs().format('YYYY-MM-DD'))
  const [detailOrder, setDetailOrder] = useState<any>(null)

  const fetchData = async (p = 1) => {
    setLoading(true)
    try {
      const res: any = await ordersApi.getAll({ page: p, page_size: 15, status: filterStatus, date: filterDate })
      setData(res.data.list)
      setTotal(res.data.total)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData(1); setPage(1) }, [filterStatus, filterDate])

  const columns = [
    { title: '订单号', dataIndex: 'order_no', width: 160, render: (v: string) => <Text code style={{ fontSize: 12 }}>{v}</Text> },
    { title: '用户', dataIndex: 'user_name' },
    { title: '公司', dataIndex: 'company_name', render: (v: string) => v || '-' },
    {
      title: '金额', dataIndex: 'total_amount',
      render: (v: string) => <Text strong style={{ color: '#f5a623' }}>¥{Number(v).toFixed(2)}</Text>,
    },
    {
      title: '状态', dataIndex: 'status',
      render: (v: string) => <Tag color={STATUS_MAP[v]?.color}>{STATUS_MAP[v]?.label}</Tag>,
    },
    { title: '下单时间', dataIndex: 'created_at', render: (v: string) => dayjs(v).format('MM-DD HH:mm') },
    {
      title: '操作', width: 80,
      render: (_: any, record: any) => (
        <Button size="small" onClick={() => setDetailOrder(record)}>详情</Button>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>订单管理</Title>
      </div>

      <Space style={{ marginBottom: 12 }}>
        <Select placeholder="订单状态" allowClear style={{ width: 120 }} onChange={setFilterStatus}>
          {Object.entries(STATUS_MAP).map(([k, v]) => <Option key={k} value={k}>{v.label}</Option>)}
        </Select>
        <DatePicker
          value={filterDate ? dayjs(filterDate) : null}
          onChange={(d) => setFilterDate(d ? d.format('YYYY-MM-DD') : '')}
          placeholder="选择日期"
        />
        <Button onClick={() => fetchData(page)}>刷新</Button>
      </Space>

      <Table rowKey="id" dataSource={data} columns={columns} loading={loading}
        pagination={{ current: page, total, pageSize: 15, onChange: (p) => { setPage(p); fetchData(p) } }}
      />

      <Modal title="订单详情" open={!!detailOrder} onCancel={() => setDetailOrder(null)} footer={null} width={500}>
        {detailOrder && (
          <>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="订单号" span={2}>
                <Text code>{detailOrder.order_no}</Text>
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
              {detailOrder.remark && <Descriptions.Item label="备注" span={2}>{detailOrder.remark}</Descriptions.Item>}
            </Descriptions>
            <Table size="small" style={{ marginTop: 12 }} pagination={false}
              dataSource={detailOrder.items || []} rowKey="id"
              columns={[
                { title: '菜品', dataIndex: 'dish_name' },
                { title: '单价', dataIndex: 'dish_price', render: (v: number) => `¥${Number(v).toFixed(2)}` },
                { title: '数量', dataIndex: 'quantity' },
                { title: '小计', dataIndex: 'subtotal', render: (v: number) => `¥${Number(v).toFixed(2)}` },
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
