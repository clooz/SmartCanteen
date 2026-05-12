import { useEffect, useState, useRef } from 'react'
import { Card, Badge, Button, Tag, Empty, Typography, Space, Divider, message, theme } from 'antd'
import { CheckOutlined, ClockCircleOutlined, BellOutlined, ReloadOutlined } from '@ant-design/icons'
import PageListShell from '../../components/PageListShell'
import { io, Socket } from 'socket.io-client'
import { ordersApi } from '../../api/orders'
import dayjs from 'dayjs'

const { Text } = Typography

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; border: string }> = {
  pending: { label: '待接单', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  confirmed: { label: '制作中', color: '#1677ff', bg: '#eff6ff', border: '#bfdbfe' },
  ready: { label: '可取餐', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
}

const COLUMN_CONFIG = [
  { status: 'pending', title: '待接单', dotColor: '#f59e0b', headerBg: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)', accentColor: '#d97706' },
  { status: 'confirmed', title: '制作中', dotColor: '#1677ff', headerBg: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', accentColor: '#1677ff' },
  { status: 'ready', title: '可取餐', dotColor: '#22c55e', headerBg: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', accentColor: '#16a34a' },
]

interface OrderItem { dish_name: string; quantity: number; subtotal: number }
interface Order {
  id: number; order_no: string; user_name: string; company_name: string
  total_amount: string; status: string; remark: string
  created_at: string; items: OrderItem[]
  meal_type?: string
}

export default function KitchenPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  const { token } = theme.useToken()

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

  const renderOrderCard = (order: Order) => {
    const s = STATUS_MAP[order.status]
    return (
      <div
        key={order.id}
        style={{
          background: '#fff',
          borderRadius: 10,
          border: `1px solid ${token.colorBorderSecondary}`,
          marginBottom: 10,
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          transition: 'box-shadow 0.2s ease',
        }}
        onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)')}
        onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)')}
      >
        {/* 卡片头部 */}
        <div style={{
          padding: '10px 14px',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#FAFBFC',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Tag style={{
              background: s?.bg,
              color: s?.color,
              border: `1px solid ${s?.border}`,
              borderRadius: 5,
              fontSize: 11,
              padding: '0 6px',
              margin: 0,
              fontWeight: 600,
            }}>
              {s?.label}
            </Tag>
            <Text style={{ fontSize: 12, color: token.colorTextTertiary, fontFamily: 'monospace' }}>
              #{order.order_no.slice(-6)}
            </Text>
            <Tag color={order.meal_type === 'breakfast' ? 'gold' : 'blue'} style={{ margin: 0 }}>
              {order.meal_type === 'breakfast' ? '早餐' : '午餐'}
            </Tag>
          </div>
          <Space size={6}>
            {order.status === 'pending' && (
              <Button
                type="primary"
                size="small"
                icon={<CheckOutlined />}
                onClick={() => updateStatus(order.id, 'confirmed')}
                style={{ fontSize: 12, height: 26, borderRadius: 6 }}
              >
                接单
              </Button>
            )}
            {order.status === 'confirmed' && (
              <Button
                size="small"
                onClick={() => updateStatus(order.id, 'ready')}
                style={{
                  fontSize: 12,
                  height: 26,
                  borderRadius: 6,
                  background: '#16a34a',
                  borderColor: '#16a34a',
                  color: '#fff',
                }}
              >
                出餐
              </Button>
            )}
            {order.status === 'ready' && (
              <Button
                size="small"
                onClick={() => updateStatus(order.id, 'done')}
                style={{ fontSize: 12, height: 26, borderRadius: 6 }}
              >
                完成
              </Button>
            )}
          </Space>
        </div>

        {/* 卡片内容 */}
        <div style={{ padding: '10px 14px' }}>
          <div style={{ marginBottom: 8 }}>
            <Text strong style={{ fontSize: 13, color: token.colorText }}>{order.user_name}</Text>
            <Text style={{ fontSize: 12, color: token.colorTextTertiary }}> · {order.company_name}</Text>
          </div>

          <Divider style={{ margin: '8px 0', borderColor: token.colorBorderSecondary }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
            {order.items?.map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 13, color: token.colorText }}>
                  {item.dish_name}
                  <span style={{ color: token.colorTextTertiary, fontSize: 12 }}> × {item.quantity}</span>
                </Text>
                <Text style={{ fontSize: 12, color: token.colorTextSecondary }}>¥{item.subtotal}</Text>
              </div>
            ))}
          </div>

          <Divider style={{ margin: '8px 0', borderColor: token.colorBorderSecondary }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 12, color: token.colorTextTertiary }}>
              <ClockCircleOutlined style={{ marginRight: 4 }} />
              {dayjs(order.created_at).format('HH:mm:ss')}
            </Text>
            <Text strong style={{ fontSize: 14, color: '#d97706' }}>¥{order.total_amount}</Text>
          </div>

          {order.remark && (
            <div style={{
              marginTop: 8,
              padding: '5px 8px',
              background: '#FFFBEB',
              borderRadius: 5,
              border: '1px solid #FDE68A',
            }}>
              <Text style={{ fontSize: 11.5, color: '#92400E' }}>备注：{order.remark}</Text>
            </div>
          )}
        </div>
      </div>
    )
  }

  const groupedOrders = {
    pending: orders.filter(o => o.status === 'pending'),
    confirmed: orders.filter(o => o.status === 'confirmed'),
    ready: orders.filter(o => o.status === 'ready'),
  }

  return (
    <PageListShell
      variant="plain"
      title="实时订单"
      subtitle={`共 ${orders.length} 个进行中的订单`}
      headerExtra={
        <Button icon={<ReloadOutlined />} onClick={fetchOrders} loading={loading}>
          刷新
        </Button>
      }
    >
      {/* 看板列 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {COLUMN_CONFIG.map(col => {
          const colOrders = groupedOrders[col.status as keyof typeof groupedOrders]
          return (
            <div key={col.status}>
              {/* 列头 */}
              <div style={{
                padding: '12px 16px',
                borderRadius: '10px 10px 0 0',
                background: col.headerBg,
                border: `1px solid ${token.colorBorderSecondary}`,
                borderBottom: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Badge color={col.dotColor} />
                  <Text strong style={{ fontSize: 14, color: '#0F172A' }}>{col.title}</Text>
                </div>
                <div style={{
                  background: col.accentColor,
                  color: '#fff',
                  borderRadius: 20,
                  padding: '2px 10px',
                  fontSize: 12,
                  fontWeight: 700,
                  minWidth: 28,
                  textAlign: 'center',
                }}>
                  {colOrders.length}
                </div>
              </div>

              {/* 列内容 */}
              <div style={{
                minHeight: 400,
                padding: 12,
                background: '#F8FAFC',
                borderRadius: '0 0 10px 10px',
                border: `1px solid ${token.colorBorderSecondary}`,
                borderTop: 'none',
              }}>
                {loading && colOrders.length === 0 ? (
                  <Card loading style={{ borderRadius: 8 }} />
                ) : colOrders.length === 0 ? (
                  <Empty
                    description={<span style={{ fontSize: 13, color: '#94A3B8' }}>暂无订单</span>}
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    style={{ marginTop: 60 }}
                  />
                ) : (
                  colOrders.map(renderOrderCard)
                )}
              </div>
            </div>
          )
        })}
      </div>
    </PageListShell>
  )
}
