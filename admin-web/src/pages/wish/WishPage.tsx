import { useState, useEffect } from 'react'
import {
  Table, Button, Tag, Modal, Form, Input, DatePicker, Space,
  message, Typography, Popconfirm, Badge, InputNumber, Descriptions,
} from 'antd'
import { PlusOutlined, TrophyOutlined, CheckOutlined } from '@ant-design/icons'
import { wishApi } from '../../api/wish'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

export default function WishPage() {
  const [activities, setActivities] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [createModal, setCreateModal] = useState(false)
  const [form] = Form.useForm()
  const [itemsModal, setItemsModal] = useState<any>(null)
  const [wishItems, setWishItems] = useState<any[]>([])
  const [adoptModal, setAdoptModal] = useState<any>(null)
  const [adoptForm] = Form.useForm()

  const fetchActivities = async () => {
    setLoading(true)
    try {
      const res: any = await wishApi.getActivities()
      setActivities(res.data || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchActivities() }, [])

  const handleCreate = async () => {
    const values = await form.validateFields()
    try {
      await wishApi.createActivity({
        title: values.title,
        description: values.description,
        start_at: values.dateRange[0].toISOString(),
        end_at: values.dateRange[1].toISOString(),
      })
      message.success('许愿活动已创建')
      setCreateModal(false)
      fetchActivities()
    } catch { /* 统一处理 */ }
  }

  const handleClose = async (id: number) => {
    try {
      await wishApi.closeActivity(id)
      message.success('活动已关闭')
      fetchActivities()
    } catch { /* 统一处理 */ }
  }

  const openItems = async (activity: any) => {
    const res: any = await wishApi.getItems(activity.id)
    setWishItems(res.data || [])
    setItemsModal(activity)
  }

  const handleAdopt = async () => {
    const values = await adoptForm.validateFields()
    try {
      await wishApi.adoptItem(adoptModal.id, values)
      message.success('已采纳，菜品已加入菜品库！')
      setAdoptModal(null)
      if (itemsModal) {
        const res: any = await wishApi.getItems(itemsModal.id)
        setWishItems(res.data || [])
      }
    } catch { /* 统一处理 */ }
  }

  const activityColumns = [
    { title: '活动标题', dataIndex: 'title', render: (v: string) => <Text strong>{v}</Text> },
    {
      title: '状态', dataIndex: 'status',
      render: (v: string) => <Badge status={v === 'active' ? 'processing' : 'default'}
        text={v === 'active' ? '进行中' : '已结束'} />,
    },
    { title: '许愿数', dataIndex: 'item_count', render: (v: number) => <Tag color="blue">{v} 条</Tag> },
    { title: '截止时间', dataIndex: 'end_at', render: (v: string) => dayjs(v).format('MM-DD HH:mm') },
    { title: '发起人', dataIndex: 'creator_name', render: (v: string) => v || '-' },
    {
      title: '操作',
      render: (_: any, record: any) => (
        <Space>
          <Button size="small" icon={<TrophyOutlined />} onClick={() => openItems(record)}>查看排行</Button>
          {record.status === 'active' && (
            <Popconfirm title="确认关闭活动？" onConfirm={() => handleClose(record.id)}>
              <Button size="small" danger>关闭</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  const itemColumns = [
    {
      title: '排名', width: 60,
      render: (_: any, __: any, i: number) => <Tag color={i < 3 ? 'red' : 'default'}>{i + 1}</Tag>,
    },
    { title: '菜品名称', dataIndex: 'dish_name', render: (v: string) => <Text strong>{v}</Text> },
    { title: '描述', dataIndex: 'description', render: (v: string) => v || '-' },
    {
      title: '票数', dataIndex: 'vote_count',
      render: (v: number) => <Tag color="orange">👍 {v} 票</Tag>,
    },
    { title: '提交人', dataIndex: 'user_name' },
    {
      title: '状态', dataIndex: 'is_adopted',
      render: (v: number) => v
        ? <Tag color="green">已采纳</Tag>
        : <Tag>未采纳</Tag>,
    },
    {
      title: '操作', width: 80,
      render: (_: any, record: any) => !record.is_adopted && (
        <Button size="small" type="primary" icon={<CheckOutlined />}
          onClick={() => { setAdoptModal(record); adoptForm.resetFields() }}>
          采纳
        </Button>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>许愿活动管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setCreateModal(true) }}>
          发起新活动
        </Button>
      </div>

      <Table rowKey="id" dataSource={activities} columns={activityColumns} loading={loading} pagination={false} />

      <Modal title="发起许愿活动" open={createModal} onOk={handleCreate} onCancel={() => setCreateModal(false)} okText="发起">
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="活动标题" rules={[{ required: true }]}>
            <Input placeholder="如：五月许愿菜品征集" />
          </Form.Item>
          <Form.Item name="description" label="活动说明">
            <Input.TextArea rows={2} placeholder="告诉大家这次许愿的主题或规则" />
          </Form.Item>
          <Form.Item name="dateRange" label="活动时间" rules={[{ required: true }]}>
            <RangePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`「${itemsModal?.title}」许愿排行榜`}
        open={!!itemsModal}
        onCancel={() => setItemsModal(null)}
        footer={null}
        width={700}
      >
        <Table rowKey="id" dataSource={wishItems} columns={itemColumns} pagination={false} size="small" />
      </Modal>

      <Modal title="采纳许愿菜品" open={!!adoptModal} onOk={handleAdopt}
        onCancel={() => setAdoptModal(null)} okText="确认采纳">
        {adoptModal && (
          <>
            <Descriptions size="small" column={1} style={{ marginBottom: 12 }}>
              <Descriptions.Item label="菜品名称">{adoptModal.dish_name}</Descriptions.Item>
              <Descriptions.Item label="描述">{adoptModal.description || '-'}</Descriptions.Item>
              <Descriptions.Item label="票数">{adoptModal.vote_count} 票</Descriptions.Item>
            </Descriptions>
            <Form form={adoptForm} layout="vertical">
              <Form.Item name="price" label="定价（元）" rules={[{ required: true, message: '请设置价格' }]}>
                <InputNumber min={0.01} step={0.5} precision={2} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="category" label="分类">
                <Input placeholder="荤菜 / 素菜 / 主食 等" />
              </Form.Item>
              <Form.Item name="description" label="菜品描述（可选）">
                <Input.TextArea rows={2} />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>
    </div>
  )
}
