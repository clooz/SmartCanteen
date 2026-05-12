import { useState, useEffect } from 'react'
import {
  Table, Button, Space, Tag, Image, Modal, Form, Input, InputNumber,
  Select, Upload, Switch, message, Typography, Popconfirm, App,
  Tooltip, Pagination, Empty, Row, Col, Card,
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, UploadOutlined,
  CheckCircleOutlined, StopOutlined, AppstoreOutlined, UnorderedListOutlined,
  PictureOutlined, ReloadOutlined,
} from '@ant-design/icons'
import { dishesApi } from '../../api/dishes'
import PageListShell, { standardTablePagination } from '../../components/PageListShell'

const { Title, Text } = Typography
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
  const [filterIsAvailable, setFilterIsAvailable] = useState<number | undefined>()
  const [filterPriceMin, setFilterPriceMin] = useState<number | undefined>()
  const [filterPriceMax, setFilterPriceMax] = useState<number | undefined>()
  const [dishToolbarKey, setDishToolbarKey] = useState(0)
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
        ...(filterIsAvailable === 0 || filterIsAvailable === 1 ? { is_available: filterIsAvailable } : {}),
        ...(filterPriceMin != null && !Number.isNaN(filterPriceMin) ? { price_min: filterPriceMin } : {}),
        ...(filterPriceMax != null && !Number.isNaN(filterPriceMax) ? { price_max: filterPriceMax } : {}),
      })
      setData(res.data.list)
      setTotal(res.data.total)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData(1); setPage(1) }, [filterCategory, filterKeyword, filterIsAvailable, filterPriceMin, filterPriceMax])

  const resetDishListFilters = () => {
    setFilterCategory(undefined)
    setFilterKeyword(undefined)
    setFilterIsAvailable(undefined)
    setFilterPriceMin(undefined)
    setFilterPriceMax(undefined)
    setDishToolbarKey(k => k + 1)
    setPage(1)
  }

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
      title: '图片', dataIndex: 'image_url',
      width: 80, align: 'center' as const,
      filters: [
        { text: '有图', value: 'yes' },
        { text: '无图', value: 'no' },
      ],
      onFilter: (v: any, r: any) =>
        v === 'yes' ? !!r.image_url : v === 'no' ? !r.image_url : true,
      render: (url: string) => url
        ? <Image src={url} width={48} height={48} style={{ borderRadius: 6, objectFit: 'cover', display: 'block', margin: '0 auto' }} />
        : <div style={{ width: 48, height: 48, background: '#f0f0f0', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bfbfbf', fontSize: 20, margin: '0 auto' }}>🍽</div>,
    },
    {
      title: '菜品名称', dataIndex: 'name',
      width: 220,
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
          {r.description && (
            <Text type="secondary" style={{ margin: 0, fontSize: 12, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.description}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: '分类', dataIndex: 'category',
      width: 110, align: 'center' as const,
      filters: CATEGORIES.map(c => ({ text: c, value: c })),
      onFilter: (value: any, record: any) => record.category === value,
      render: (v: string) => <Tag style={{ margin: 0 }}>{v}</Tag>,
    },
    {
      title: '价格', dataIndex: 'price',
      width: 110, align: 'right' as const,
      sorter: (a: any, b: any) => Number(a.price) - Number(b.price),
      render: (v: number) => <Text strong>¥{Number(v).toFixed(2)}</Text>,
    },
    {
      title: '状态', dataIndex: 'is_available',
      width: 110, align: 'center' as const,
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
      title: '操作', width: 150, align: 'left' as const,
      render: (_: any, record: any) => (
        <Space size={4}>
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
      <div className="dish-card-grid">
        {loading
          ? Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="dish-card-item">
                <Card loading className="dish-card" />
              </div>
            ))
          : data.length === 0
            ? (
              <div style={{ gridColumn: '1 / -1' }}>
                <Empty description="暂无菜品" style={{ padding: '48px 0' }} />
              </div>
            )
            : data.map(item => (
              <div key={item.id} className="dish-card-item">
                <Card
                  hoverable
                  className="dish-card"
                  styles={{ body: { flex: 1, padding: '12px 14px', display: 'flex', flexDirection: 'column' } }}
                  cover={
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      {item.image_url
                        ? <img src={item.image_url} alt={item.name}
                            style={{ height: 140, width: '100%', objectFit: 'cover', display: 'block' }} />
                        : <div style={{
                            height: 140, background: 'linear-gradient(135deg, #f0f5ff 0%, #e6f4ff 100%)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 44, color: '#adc6ff',
                          }}>🍽️</div>
                      }
                      {/* 上架/下架 悬浮在图片右上角 */}
                      <div style={{ position: 'absolute', top: 8, right: 8 }}>
                        <Switch
                          size="small"
                          checked={!!item.is_available}
                          checkedChildren="上架"
                          unCheckedChildren="下架"
                          onChange={() => handleToggleAvailable(item)}
                          style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }}
                        />
                      </div>
                    </div>
                  }
                >
                  {/* 名称 + 分类标签 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <Text strong style={{ fontSize: 14, lineHeight: '22px', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={item.name}>
                      {item.name}
                    </Text>
                    <Tag color="blue" style={{ margin: 0, flexShrink: 0, fontSize: 11, lineHeight: '20px', padding: '0 6px' }}>
                      {item.category}
                    </Tag>
                  </div>

                  {/* 描述 — 固定 1 行高度，无内容时占位 */}
                  <div style={{ height: 18, overflow: 'hidden', marginBottom: 0 }}>
                    <Text type="secondary" style={{ fontSize: 12, lineHeight: '18px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.description || '\u00A0'}
                    </Text>
                  </div>

                  {/* 弹性空白，推动底部对齐 */}
                  <div style={{ flex: 1 }} />

                  {/* 底部：价格 + 操作按钮 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, marginTop: 8, borderTop: '1px solid #f0f0f0' }}>
                    <Text strong style={{ fontSize: 16, color: '#1890ff', letterSpacing: '-0.3px' }}>
                      ¥{Number(item.price).toFixed(2)}
                    </Text>
                    <Space size={0}>
                      <Tooltip title="编辑">
                        <Button
                          size="small" type="text"
                          icon={<EditOutlined />}
                          onClick={() => openEdit(item)}
                          style={{ color: '#8c8c8c' }}
                        />
                      </Tooltip>
                      <Popconfirm title="确定删除此菜品？" okType="danger" okText="删除" cancelText="取消"
                        onConfirm={() => handleDelete(item.id)}>
                        <Tooltip title="删除">
                          <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                        </Tooltip>
                      </Popconfirm>
                    </Space>
                  </div>
                </Card>
              </div>
            ))
        }
      </div>

      {!loading && data.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <Pagination
            {...standardTablePagination({
              current: page,
              total,
              pageSize,
              onChange: (p, ps) => { setPage(p); setPageSize(ps); fetchData(p, ps) },
            })}
          />
        </div>
      )}
    </>
  )

  return (
    <>
      <PageListShell
        title="菜品管理"
        headerExtra={
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
        }
        filterLeft={
          <>
            <Text type="secondary" style={{ fontSize: 13 }}>分类</Text>
            <Select placeholder="全部" allowClear style={{ width: 120 }}
              onChange={v => setFilterCategory(v)} value={filterCategory}>
              {CATEGORIES.map(c => <Option key={c} value={c}>{c}</Option>)}
            </Select>
            <Text type="secondary" style={{ fontSize: 13 }}>名称</Text>
            <Input.Search key={`d-lk-${dishToolbarKey}`} placeholder="搜索菜品名" onSearch={v => setFilterKeyword(v || undefined)} allowClear style={{ width: 180 }} />
            <Text type="secondary" style={{ fontSize: 13 }}>上架</Text>
            <Select placeholder="全部" allowClear style={{ width: 100 }} value={filterIsAvailable}
              onChange={v => setFilterIsAvailable(v)}
              options={[{ label: '上架', value: 1 }, { label: '下架', value: 0 }]}
            />
            <Text type="secondary" style={{ fontSize: 13 }}>价格</Text>
            <InputNumber min={0} placeholder="最低" style={{ width: 88 }} value={filterPriceMin}
              onChange={v => setFilterPriceMin(v === null ? undefined : Number(v))} />
            <Text type="secondary" style={{ fontSize: 13 }}>~</Text>
            <InputNumber min={0} placeholder="最高" style={{ width: 88 }} value={filterPriceMax}
              onChange={v => setFilterPriceMax(v === null ? undefined : Number(v))} />
          </>
        }
        filterRight={
          <Space>
            <Button onClick={resetDishListFilters}>重置筛选</Button>
            <Button icon={<ReloadOutlined />} onClick={() => fetchData(page, pageSize)}>刷新</Button>
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
          </Space>
        }
      >
        {viewMode === 'list' ? (
          <Table
            rowKey="id"
            size="middle"
            dataSource={data}
            columns={columns}
            loading={loading}
            scroll={{ x: 800 }}
            rowSelection={{
              selectedRowKeys,
              onChange: keys => setSelectedRowKeys(keys as number[]),
            }}
            pagination={standardTablePagination({
              current: page,
              total,
              pageSize,
              onChange: (p, ps) => { setPage(p); setPageSize(ps); fetchData(p, ps) },
            })}
          />
        ) : (
          <div style={{ paddingBottom: 24 }}>
            {renderCardView()}
          </div>
        )}
      </PageListShell>

      {/* 新增/编辑弹窗 */}
      <Modal
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        width={460}
        destroyOnHidden
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 30, height: 30,
              borderRadius: 8,
              background: editingId ? '#EFF6FF' : '#F0FDF4',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              {editingId
                ? <EditOutlined style={{ color: '#1677ff', fontSize: 14 }} />
                : <PlusOutlined style={{ color: '#16a34a', fontSize: 14 }} />
              }
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', lineHeight: 1.3 }}>
                {editingId ? '编辑菜品' : '新增菜品'}
              </div>
              <div style={{ fontSize: 12, color: '#94A3B8', fontWeight: 400, marginTop: 1 }}>
                {editingId ? '修改后点击保存生效' : '填写信息后即可创建'}
              </div>
            </div>
          </div>
        }
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setModalOpen(false)}>取消</Button>
            <Button
              type="primary"
              onClick={handleSubmit}
              icon={editingId ? <EditOutlined /> : <PlusOutlined />}
            >
              {editingId ? '保存修改' : '创建菜品'}
            </Button>
          </div>
        }
      >
        <Form form={form} layout="vertical">
          {/* 菜品名称 */}
          <Form.Item
            name="name"
            label="菜品名称"
            rules={[{ required: true, message: '请输入菜品名称' }]}
          >
            <Input placeholder="请输入菜品名称" />
          </Form.Item>

          {/* 价格 + 分类 并排 */}
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="price"
                label="价格（元）"
                rules={[{ required: true, message: '请输入价格' }]}
              >
                <InputNumber
                  min={0.01} step={0.5} precision={2}
                  placeholder="0.00"
                  prefix="¥"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="category" label="分类" initialValue="其他">
                <Select>
                  {CATEGORIES.map(c => <Option key={c} value={c}>{c}</Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {/* 描述 */}
          <Form.Item name="description" label="描述（可选）">
            <Input.TextArea
              rows={2}
              placeholder="简短介绍菜品口味、特点等"
              style={{ resize: 'none' }}
            />
          </Form.Item>

          {/* 上架状态 — 独占一行 */}
          <Form.Item label="上架状态">
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '9px 14px',
              background: '#F8FAFC',
              borderRadius: 8,
              border: '1px solid #E2E8F0',
            }}>
              <Form.Item name="is_available" valuePropName="checked" noStyle>
                <Switch checkedChildren="上架" unCheckedChildren="下架" />
              </Form.Item>
              <span style={{ fontSize: 13, color: '#64748B' }}>
                控制菜品在点餐小程序中的可见状态
              </span>
            </div>
          </Form.Item>

          {/* 菜品图片 — 独占一行 */}
          <Form.Item label="菜品图片" style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <Upload
                listType="picture-card"
                fileList={fileList}
                maxCount={1}
                beforeUpload={() => false}
                onChange={({ fileList }) => setFileList(fileList)}
              >
                {fileList.length === 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, color: '#94A3B8' }}>
                    <PictureOutlined style={{ fontSize: 20 }} />
                    <span style={{ fontSize: 12 }}>点击上传</span>
                  </div>
                )}
              </Upload>
              <span style={{ fontSize: 12, color: '#94A3B8', lineHeight: 1.6, marginTop: 4 }}>
                支持 JPG / PNG<br />建议尺寸 400×400
              </span>
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
