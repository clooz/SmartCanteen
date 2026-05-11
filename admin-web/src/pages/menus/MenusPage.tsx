import { useState, useEffect } from 'react'
import {
  Table, Button, Tag, Modal, DatePicker, Select, Space, message,
  Typography, Popconfirm, Transfer, InputNumber, Descriptions,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { menusApi } from '../../api/menus'
import { dishesApi } from '../../api/dishes'
import dayjs, { Dayjs } from 'dayjs'

const { Title } = Typography

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'default' },
  published: { label: '已发布', color: 'green' },
  closed: { label: '已关闭', color: 'red' },
}

export default function MenusPage() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(null)
  const [allDishes, setAllDishes] = useState<any[]>([])
  const [selectedDishIds, setSelectedDishIds] = useState<string[]>([])
  const [editingMenuId, setEditingMenuId] = useState<number | null>(null)
  const [detailModal, setDetailModal] = useState<any>(null)

  const fetchData = async (p = 1) => {
    setLoading(true)
    try {
      const res: any = await menusApi.getList({ page: p, page_size: 10 })
      setData(res.data.list)
      setTotal(res.data.total)
    } finally {
      setLoading(false)
    }
  }

  const fetchAllDishes = async () => {
    const res: any = await dishesApi.getList({ is_available: 1, page_size: 200 })
    setAllDishes(res.data.list)
  }

  useEffect(() => { fetchData(); fetchAllDishes() }, [])

  const openCreate = () => {
    setEditingMenuId(null)
    setSelectedDate(null)
    setSelectedDishIds([])
    setModalOpen(true)
  }

  const openEdit = async (record: any) => {
    setEditingMenuId(record.id)
    setSelectedDate(dayjs(record.menu_date))
    const res: any = await menusApi.getByDate(record.menu_date)
    setSelectedDishIds((res.data?.dishes || []).map((d: any) => String(d.id)))
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    if (!selectedDate) return message.error('请选择日期')
    if (selectedDishIds.length === 0) return message.error('请至少选择一道菜品')
    try {
      await menusApi.createOrUpdate({
        menu_date: selectedDate.format('YYYY-MM-DD'),
        dish_ids: selectedDishIds.map(Number),
        status: 'draft',
      })
      message.success('菜单保存成功')
      setModalOpen(false)
      fetchData(page)
    } catch { /* 统一处理 */ }
  }

  const handleStatusChange = async (id: number, status: string) => {
    try {
      await menusApi.updateStatus(id, status)
      message.success('状态更新成功')
      fetchData(page)
    } catch { /* 统一处理 */ }
  }

  const handleDelete = async (id: number) => {
    try {
      await menusApi.delete(id)
      message.success('菜单已删除')
      fetchData(page)
    } catch { /* 统一处理 */ }
  }

  const openDetail = async (record: any) => {
    const res: any = await menusApi.getByDate(record.menu_date)
    setDetailModal(res.data)
  }

  const columns = [
    { title: '日期', dataIndex: 'menu_date', render: (v: string) => dayjs(v).format('YYYY-MM-DD (ddd)') },
    {
      title: '状态', dataIndex: 'status',
      render: (v: string) => <Tag color={STATUS_MAP[v]?.color}>{STATUS_MAP[v]?.label}</Tag>,
    },
    { title: '创建人', dataIndex: 'creator_name', render: (v: string) => v || '-' },
    {
      title: '操作',
      render: (_: any, record: any) => (
        <Space>
          <Button size="small" onClick={() => openDetail(record)}>查看</Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>编辑</Button>
          {record.status === 'draft' && (
            <Button size="small" type="primary"
              onClick={() => handleStatusChange(record.id, 'published')}>发布</Button>
          )}
          {record.status === 'published' && (
            <Button size="small" danger
              onClick={() => handleStatusChange(record.id, 'closed')}>关闭</Button>
          )}
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const transferDataSource = allDishes.map(d => ({
    key: String(d.id),
    title: `${d.name} ¥${Number(d.price).toFixed(2)}`,
    description: d.category,
  }))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>菜单管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建菜单</Button>
      </div>

      <Table rowKey="id" dataSource={data} columns={columns} loading={loading}
        pagination={{ current: page, total, pageSize: 10, onChange: (p) => { setPage(p); fetchData(p) } }}
      />

      <Modal title={editingMenuId ? '编辑菜单' : '新建菜单'} open={modalOpen} width={720}
        onOk={handleSubmit} onCancel={() => setModalOpen(false)} okText="保存">
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <span style={{ marginRight: 8 }}>菜单日期：</span>
            <DatePicker value={selectedDate} onChange={setSelectedDate}
              disabledDate={d => d < dayjs().startOf('day')} />
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ marginBottom: 8 }}>选择今日供应菜品（已选 {selectedDishIds.length} 道）：</div>
            <Transfer
              dataSource={transferDataSource}
              targetKeys={selectedDishIds}
              onChange={(keys) => setSelectedDishIds(keys as string[])}
              render={(item) => item.title}
              titles={['菜品库', '今日供应']}
              listStyle={{ width: 280, height: 320 }}
              showSearch
            />
          </div>
        </Space>
      </Modal>

      <Modal title="菜单详情" open={!!detailModal} onCancel={() => setDetailModal(null)} footer={null}>
        {detailModal && (
          <>
            <Descriptions column={2} size="small">
              <Descriptions.Item label="日期">{detailModal.menu_date}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={STATUS_MAP[detailModal.status]?.color}>
                  {STATUS_MAP[detailModal.status]?.label}
                </Tag>
              </Descriptions.Item>
            </Descriptions>
            <Table size="small" style={{ marginTop: 12 }}
              dataSource={detailModal.dishes || []} rowKey="id"
              pagination={false}
              columns={[
                { title: '菜品', dataIndex: 'name' },
                { title: '分类', dataIndex: 'category', render: (v: string) => <Tag>{v}</Tag> },
                { title: '价格', dataIndex: 'price', render: (v: number) => `¥${Number(v).toFixed(2)}` },
                { title: '限量', dataIndex: 'stock', render: (v: number) => v ?? '不限' },
              ]}
            />
          </>
        )}
      </Modal>
    </div>
  )
}
