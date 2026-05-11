import { useState, useEffect } from 'react'
import {
  Table, Button, Space, Tag, Image, Modal, Form, Input, InputNumber,
  Select, Upload, Switch, message, Typography, Popconfirm, App,
  Card, Row, Col, Tooltip, Badge, Pagination, Empty,
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, UploadOutlined,
  CheckCircleOutlined, StopOutlined, AppstoreOutlined, UnorderedListOutlined,
} from '@ant-design/icons'
import { dishesApi } from '../../api/dishes'

const { Title, Text, Paragraph } = Typography
const { Option } = Select

const CATEGORIES = ['主食', '荤菜', '素菜', '汤', '小吃', '饮料', '其他']

type ViewMode = 'list' | 'card'

export default function DishesPage() {
  const { modal } = App.useApp()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form] = Form.useForm()
  const [fileList, setFileList] = useState<any[]>([])
  const [filterCategory, setFilterCategory] = useState<string>()
  const [filterKeyword, setFilterKeyword] = useState<string>()
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([])
  const [batchLoading, setBatchLoading] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    (localStorage.getItem('dishViewMode') as ViewMode) || 'list'
  )

  const fetchData = async (p = page, ps = pageSize) => {
    setLoading(true)
    try {
      const res: any = await dishesApi.getList({
        page: p, page_size: ps,
        category: filterCategory,
        keyword: filterKeyword,
      })
      setData(res.data.list)
      setTotal(res.data.total)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData(1); setPage(1) }, [filterCategory, filterKeyword])

  const switchView = (mode: ViewMode) => {
    setViewMode(mode)
    localStorage.setItem('dishViewMode', mode)
  }

  const openCreate = () => {
    setEditingId(null)
    form.resetFields()
    form.setFieldsValue({ is_available: true, category: '其他' })
    setFileList([])
    setModalOpen(true)
  }

  const openEdit = (record: any) => {
    setEditingId(record.id)
    form.setFieldsValue({
      name: record.name, description: record.description,
      price: record.price, category: record.category,
      is_available: record.is_available === 1,
    })
    setFileList(record.image_url ? [{ uid: '-1', name: 'image', status: 'done', url: record.image_url }] : [])
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    const values = await form.validateFields()
    const formData = new FormData()
    formData.append('name', values.name)
    formData.append('price', values.price)
    formData.append('category', values.category || '其他')
    if (values.description) formData.append('description', values.description)
    formData.append('is_available', values.is_available ? '1' : '0')
    if (fileList[0]?.originFileObj) formData.append('image', fileList[0].originFileObj)

    try {
      if (editingId === null) {
        await dishesApi.create(formData)
        message.success('菜品已创建')
      } else {
        await dishesApi.update(editingId, formData)
        message.success('菜品已更新')
      }
      setModalOpen(false)
      fetchData(editingId ? page : 1)
    } catch { /* 统一处理 */ }
  }

  const handleDelete = async (id: number) => {
    try {
      await dishesApi.delete(id)
      message.success('菜品已删除')
      fetchData(page)
    } catch { /* 统一处理 */ }
  }

  const handleToggleAvailable = async (record: any) => {
    try {
      const fd = new FormData()
      fd.append('is_available', record.is_available ? '0' : '1')
      await dishesApi.update(record.id, fd)
      message.success(record.is_available ? '已下架' : '已上架')
      fetchData(page)
    } catch { /* 统一处理 */ }
  }

  const handleBatchDelete = () => {
    modal.confirm({
      title: `确定删除选中的 ${selectedRowKeys.length} 个菜品？`,
      content: '删除后无法恢复',
      okText: '确定删除', okType: 'danger', cancelText: '取消',
      onOk: async () => {
        setBatchLoading(true)
        try {
          await Promise.all(selectedRowKeys.map(id => dishesApi.delete(id)))
          message.success(`已删除 ${selectedRowKeys.length} 个菜品`)
          setSelectedRowKeys([])
          fetchData(1)
        } finally { setBatchLoading(false) }
      },
    })
  }

  const handleBatchSetAvailable = async (available: 0 | 1) => {
    setBatchLoading(true)
    try {
      await Promise.all(selectedRowKeys.map(id => {
        const fd = new FormData()
        fd.append('is_available', String(available))
        return dishesApi.update(id, fd)
      }))
      message.success(`已批量${available ? '上架' : '下架'} ${selectedRowKeys.length} 个菜品`)
      setSelectedRowKeys([])
      fetchData(page)
    } finally { setBatchLoading(false) }
  }

  const columns = [
    {
      title: '图片', dataIndex: 'image_url', width: 72,
      render: (url: string) => url
        ? <Image src={url} width={48} height={48} style={{ borderRadius: 6, objectFit: 'cover' }} />
        : <div style={{ width: 48, height: 48, background: '#f0f0f0', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bfbfbf', fontSize: 20 }}>🍽</div>,
    },
    {
      title: '菜品名称', dataIndex: 'name',
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
        <div style={{ padding: 8 }}>
          <Input placeholder="搜索菜品名称" value={selectedKeys[0]}
            onChange={e => setSelectedKeys(e.target.value ? [e.target.value] : [])}
            onPressEnter={() => { setFilterKeyword(selectedKeys[0]); confirm() }}
            style={{ marginBottom: 8, display: 'block' }} />
          <Space>
            <Button type="primary" size="small" onClick={() => { setFilterKeyword(selectedKeys[0]); confirm() }}>搜索</Button>
            <Button size="small" onClick={() => { clearFilters?.(); setFilterKeyword(undefined) }}>重置</Button>
          </Space>
        </div>
      ),
      render: (v: string, r: any) => (
        <div>
          <Text strong>{v}</Text>
          {r.description && <Paragraph type="secondary" ellipsis style={{ margin: 0, fontSize: 12 }}>{r.description}</Paragraph>}
        </div>
      ),
    },
    {
      title: '分类', dataIndex: 'category', width: 100,
      filters: CATEGORIES.map(c => ({ text: c, value: c })),
      onFilter: (value: any, record: any) => record.category === value,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: '价格', dataIndex: 'price', width: 100,
      sorter: (a: any, b: any) => Number(a.price) - Number(b.price),
      render: (v: number) => <Text strong>¥{Number(v).toFixed(2)}</Text>,
    },
    {
      title: '状态', dataIndex: 'is_available', width: 100,
      filters: [{ text: '上架', value: 1 }, { text: '下架', value: 0 }],
      onFilter: (value: any, record: any) => record.is_available === value,
      render: (v: number, record: any) => (
        <Switch
          size="small"
          checked={!!v}
          checkedChildren="上架"
          unCheckedChildren="下架"
          onChange={() => handleToggleAvailable(record)}
        />
      ),
    },
    {
      title: '操作', width: 120,
      render: (_: any, record: any) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>编辑</Button>
          <Popconfirm title="确定删除此菜品？" okType="danger" okText="删除" cancelText="取消"
            onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const hasSelected = selectedRowKeys.length > 0

  // 卡片视图
  const renderCardView = () => (
    <>
      <Row gutter={[16, 16]}>
        {loading
          ? Array.from({ length: pageSize }).map((_, i) => (
              <Col key={i} xs={24} sm={12} md={8} lg={6} xl={6}>
                <Card loading style={{ borderRadius: 8 }} />
              </Col>
            ))
          : data.length === 0
            ? <Col span={24}><Empty description="暂无菜品" /></Col>
            : data.map(item => (
                <Col key={item.id} xs={24} sm={12} md={8} lg={6} xl={6}>
                  <Card
                    hoverable
                    style={{ borderRadius: 8, overflow: 'hidden' }}
                    cover={
                      item.image_url
                        ? <img src={item.image_url} alt={item.name}
                            style={{ height: 160, objectFit: 'cover', display: 'block' }} />
                        : <div style={{
                            height: 160, background: '#f5f5f5',
                            display: 'flex', alignItems: 'center',
                            justifyContent: 'center', fontSize: 48, color: '#d9d9d9',
                          }}>🍽</div>
                    }
                    actions={[
                      <Tooltip title="编辑" key="edit">
                        <EditOutlined onClick={() => openEdit(item)} />
                      </Tooltip>,
                      <Tooltip title={item.is_available ? '点击下架' : '点击上架'} key="toggle">
                        <span onClick={() => handleToggleAvailable(item)}>
                          {item.is_available
                            ? <CheckCircleOutlined style={{ color: '#52c41a' }} />
                            : <StopOutlined style={{ color: '#d9d9d9' }} />}
                        </span>
                      </Tooltip>,
                      <Popconfirm key="delete" title="确定删除？" okType="danger" okText="删除" cancelText="取消"
                        onConfirm={() => handleDelete(item.id)}>
                        <Tooltip title="删除">
                          <DeleteOutlined style={{ color: '#ff4d4f' }} />
                        </Tooltip>
                      </Popconfirm>,
                    ]}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <Text strong style={{ fontSize: 15, flex: 1, marginRight: 8 }} ellipsis>{item.name}</Text>
                      <Badge
                        status={item.is_available ? 'success' : 'default'}
                        text={<Text style={{ fontSize: 12 }}>{item.is_available ? '上架' : '下架'}</Text>}
                      />
                    </div>
                    {item.description && (
                      <Paragraph type="secondary" ellipsis={{ rows: 2 }}
                        style={{ fontSize: 12, marginBottom: 8 }}>
                        {item.description}
                      </Paragraph>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Tag style={{ margin: 0 }}>{item.category}</Tag>
                      <Text strong style={{ fontSize: 16 }}>¥{Number(item.price).toFixed(2)}</Text>
                    </div>
                  </Card>
                </Col>
              ))
        }
      </Row>
      {!loading && data.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <Pagination
            current={page} total={total} pageSize={pageSize}
            showSizeChanger showTotal={t => `共 ${t} 条`}
            onChange={(p, ps) => { setPage(p); setPageSize(ps); fetchData(p, ps) }}
          />
        </div>
      )}
    </>
  )

  return (
    <div>
      {/* 页头 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>菜品管理</Title>
        <Space>
          {hasSelected && (
            <>
              <Text type="secondary">已选 <Text strong style={{ color: '#1890ff' }}>{selectedRowKeys.length}</Text> 项</Text>
              <Button icon={<CheckCircleOutlined />} loading={batchLoading} onClick={() => handleBatchSetAvailable(1)}>批量上架</Button>
              <Button icon={<StopOutlined />} loading={batchLoading} onClick={() => handleBatchSetAvailable(0)}>批量下架</Button>
              <Button danger icon={<DeleteOutlined />} loading={batchLoading} onClick={handleBatchDelete}>批量删除</Button>
            </>
          )}
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增菜品</Button>
        </Space>
      </div>

      <Card styles={{ body: { paddingBottom: 0 } }}>
        {/* 筛选栏 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Space>
            <Select placeholder="全部分类" allowClear style={{ width: 130 }}
              onChange={v => setFilterCategory(v)} value={filterCategory}>
              {CATEGORIES.map(c => <Option key={c} value={c}>{c}</Option>)}
            </Select>
            <Input.Search placeholder="搜索菜品名" onSearch={setFilterKeyword} allowClear style={{ width: 200 }} />
          </Space>
          {/* 视图切换 */}
          <Space.Compact>
            <Tooltip title="列表视图">
              <Button
                icon={<UnorderedListOutlined />}
                type={viewMode === 'list' ? 'primary' : 'default'}
                onClick={() => switchView('list')}
              />
            </Tooltip>
            <Tooltip title="卡片视图">
              <Button
                icon={<AppstoreOutlined />}
                type={viewMode === 'card' ? 'primary' : 'default'}
                onClick={() => switchView('card')}
              />
            </Tooltip>
          </Space.Compact>
        </div>

        {/* 列表 / 卡片 视图 */}
        {viewMode === 'list' ? (
          <Table
            rowKey="id"
            dataSource={data}
            columns={columns}
            loading={loading}
            rowSelection={{
              selectedRowKeys,
              onChange: keys => setSelectedRowKeys(keys as number[]),
            }}
            pagination={{
              current: page, total, pageSize,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50'],
              showTotal: t => `共 ${t} 条`,
              onChange: (p, ps) => { setPage(p); setPageSize(ps); fetchData(p, ps) },
            }}
          />
        ) : (
          <div style={{ paddingBottom: 24 }}>
            {renderCardView()}
          </div>
        )}
      </Card>

      {/* 新增/编辑弹窗 */}
      <Modal
        title={editingId ? '编辑菜品' : '新增菜品'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText="保存" cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="菜品名称" rules={[{ required: true, message: '请输入菜品名称' }]}>
            <Input placeholder="请输入菜品名称" />
          </Form.Item>
          <Form.Item name="price" label="价格（元）" rules={[{ required: true, message: '请输入价格' }]}>
            <InputNumber min={0.01} step={0.5} style={{ width: '100%' }} precision={2} placeholder="0.00" />
          </Form.Item>
          <Form.Item name="category" label="分类" initialValue="其他">
            <Select>
              {CATEGORIES.map(c => <Option key={c} value={c}>{c}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="可选，简短介绍菜品" />
          </Form.Item>
          <Form.Item name="is_available" label="上架状态" valuePropName="checked" initialValue={true}>
            <Switch checkedChildren="上架" unCheckedChildren="下架" />
          </Form.Item>
          <Form.Item label="菜品图片">
            <Upload listType="picture-card" fileList={fileList} maxCount={1}
              beforeUpload={() => false}
              onChange={({ fileList }) => setFileList(fileList)}>
              {fileList.length === 0 && <div><UploadOutlined /><div style={{ marginTop: 8 }}>上传图片</div></div>}
            </Upload>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
