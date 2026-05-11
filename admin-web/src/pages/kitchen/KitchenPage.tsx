import { useEffect, useState, useRef } from 'react'
import { Card, Badge, Button, Tag, Empty, Typography, Space, Row, Col, Divider, message } from 'antd'
import { CheckOutlined, ClockCircleOutlined, BellOutlined } from '@ant-design/icons'
import { io, Socket } from 'socket.io-client'
import { ordersApi } from '../../api/orders'
import dayjs from 'dayjs'

const { Title, Text } = Typography

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: '待接单', color: 'gold' },
  confirmed: { label: '制作中', color: 'blue' },
  ready: { label: '可取餐', color: 'green' },
}

interface OrderItem { dish_name: string; quantity: number; subtotal: number }
interface Order {
  id: number; order_no: string; user_name: string; company_name: string
  total_amount: string; status: string; remark: string
  created_at: string; items: OrderItem[]
}

export default function KitchenPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const socketRef = useRef<Socket | null>(null)

  const fetchOrders = async () => {
    setLoading(true)
    try {
      const [r1, r2, r3]: any[] = await Promise.all([
        ordersApi.getAll({ status: 'pending', page_size: 50 }),
        ordersApi.getAll({ status: 'confirmed', page_size: 50 }),
        ordersApi.getAll({ status: 'ready', page_size: 50 }),
      ])
      setOrders([
        ...(r1.data?.list || []),
        ...(r2.data?.list || []),
        ...(r3.data?.list || []),
      ])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
    const socket = io('/', { path: '/socket.io' })
    socketRef.current = socket
    socket.on('connect', () => { socket.emit('join_kitchen') })
    socket.on('new_order', (order: Order) => {
      message.info({ content: `新订单！来自 ${order.user_name}`, icon: <BellOutlined /> })
      setOrders(prev => [order, ...prev])
    })
    socket.on('order_status_changed', ({ order_id, status }: { order_id: number; status: string }) => {
      setOrders(prev =>
        status === 'done' || status === 'cancelled'
          ? prev.filter(o => o.id !== order_id)
          : prev.map(o => o.id === order_id ? { ...o, status } : o)
      )
    })
    return () => { socket.disconnect() }
  }, [])

  const updateStatus = async (id: number, status: string) => {
    try {
      await ordersApi.updateStatus(id, status)
      message.success('状态已更新')
      if (status === 'done' || status === 'cancelled') {
        setOrders(prev => prev.filter(o => o.id !== id))
      } else {
        setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o))
      }
    } catch { /* 统一处理 */ }
  }

  const pendingOrders = orders.filter(o => o.status === 'pending')
  const confirmedOrders = orders.filter(o => o.status === 'confirmed')
  const readyOrders = orders.filter(o => o.status === 'ready')

  const renderOrderCard = (order: Order) => (
    <Card
      key={order.id}
      size="small"
      style={{ marginBottom: 12 }}
      title={
        <Space>
          <Tag color={STATUS_MAP[order.status]?.color}>{STATUS_MAP[order.status]?.label}</Tag>
          <Text strong style={{ fontSize: 12 }}>{order.order_no}</Text>
        </Space>
      }
      extra={
        <Space>
          {order.status === 'pending' && (
            <Button type="primary" size="small" icon={<CheckOutlined />}
              onClick={() => updateStatus(order.id, 'confirmed')}>接单</Button>
          )}
          {order.status === 'confirmed' && (
            <Button type="primary" size="small" style={{ background: '#52c41a', borderColor: '#52c41a' }}
              onClick={() => updateStatus(order.id, 'ready')}>出餐</Button>
          )}
          {order.status === 'ready' && (
            <Button size="small" onClick={() => updateStatus(order.id, 'done')}>完成</Button>
          )}
        </Space>
      }
    >
      <Space direction="vertical" style={{ width: '100%' }} size={4}>
        <Text><Text strong>{order.user_name}</Text> · {order.company_name}</Text>
        <Divider style={{ margin: '6px 0' }} />
        {order.items?.map((item, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text>{item.dish_name} × {item.quantity}</Text>
            <Text type="secondary">¥{item.subtotal}</Text>
          </div>
        ))}
        <Divider style={{ margin: '6px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Text type="secondary">合计</Text>
          <Text strong style={{ color: '#f5a623' }}>¥{order.total_amount}</Text>
        </div>
        {order.remark && <Text type="secondary" style={{ fontSize: 12 }}>备注：{order.remark}</Text>}
        <Text type="secondary" style={{ fontSize: 11 }}>
          <ClockCircleOutlined /> {dayjs(order.created_at).format('HH:mm:ss')}
        </Text>
      </Space>
    </Card>
  )

  const KanbanColumn = ({ title, color, count, children }: any) => (
    <Col span={8}>
      <Card
        title={
          <Space>
            <Badge color={color} />
            <Text strong>{title}</Text>
            <Badge count={count} color={color} />
          </Space>
        }
        style={{ minHeight: 400 }}
        loading={loading}
      >
        {children.length === 0
          ? <Empty description="暂无订单" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          : children
        }
      </Card>
    </Col>
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>实时订单</Title>
        <Button onClick={fetchOrders}>刷新</Button>
      </div>
      <Row gutter={16}>
        <KanbanColumn title="待接单" color="gold" count={pendingOrders.length}>
          {pendingOrders.map(renderOrderCard)}
        </KanbanColumn>
        <KanbanColumn title="制作中" color="blue" count={confirmedOrders.length}>
          {confirmedOrders.map(renderOrderCard)}
        </KanbanColumn>
        <KanbanColumn title="可取餐" color="green" count={readyOrders.length}>
          {readyOrders.map(renderOrderCard)}
        </KanbanColumn>
      </Row>
    </div>
  )
}
