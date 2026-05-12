import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Table, Button, Tag, Modal, Form, Input, DatePicker, Space,
  message, Typography, Popconfirm, Badge, InputNumber, Descriptions, Select, App, List, Avatar, Spin, Tooltip,
} from 'antd'
import { PlusOutlined, TrophyOutlined, CheckOutlined, LikeOutlined, ReloadOutlined, StopOutlined, CommentOutlined, DeleteOutlined, UserOutlined } from '@ant-design/icons'
import PageListShell, { standardTablePagination } from '../../components/PageListShell'
import { textFilterDropdown } from '../../utils/tableColumnFilters'
import { wishApi } from '../../api/wish'
import dayjs from 'dayjs'

const { Text } = Typography
const { RangePicker } = DatePicker

export default function WishPage() {
  const { modal } = App.useApp()

  const [activities, setActivities] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [createModal, setCreateModal] = useState(false)
  const [form] = Form.useForm()
  const [itemsModal, setItemsModal] = useState<any>(null)
  const [wishItems, setWishItems] = useState<any[]>([])
  const [adoptModal, setAdoptModal] = useState<any>(null)
  const [adoptForm] = Form.useForm()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [fTitle, setFTitle] = useState<string | undefined>()
  const [fActivityStatus, setFActivityStatus] = useState<string | undefined>()
  const [fCreator, setFCreator] = useState<string | undefined>()
  const [fItemCount, setFItemCount] = useState<number | undefined>()
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([])
  const [batchLoading, setBatchLoading] = useState(false)
  const [expandedRowKeys, setExpandedRowKeys] = useState<number[]>([])
  const [commentMap, setCommentMap] = useState<Record<number, any[]>>({})
  const [commentLoadingSet, setCommentLoadingSet] = useState<Set<number>>(new Set())

  const filteredActivities = useMemo(() => {
    return activities.filter((row) => {
      if (fTitle && !String(row.title || '').toLowerCase().includes(fTitle.toLowerCase())) return false
      if (fActivityStatus && row.status !== fActivityStatus) return false
      if (fCreator && !String(row.creator_name || '').toLowerCase().includes(fCreator.toLowerCase())) return false
      if (fItemCount != null && Number(row.item_count ?? 0) !== fItemCount) return false
      return true
    })
  }, [activities, fTitle, fActivityStatus, fCreator, fItemCount])

  const pagedActivities = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredActivities.slice(start, start + pageSize)
  }, [filteredActivities, page, pageSize])

  useEffect(() => { setPage(1) }, [fTitle, fActivityStatus, fCreator, fItemCount])

  const fetchActivities = async () => {
    setLoading(true)
    setSelectedRowKeys([])
    try {
      const res: any = await wishApi.getActivities()
      setActivities(res.data || [])
      setPage(1)
    } finally {
      setLoading(false)
    }
  }

  const handleBatchClose = () => {
    const targets = pagedActivities.filter(r => selectedRowKeys.includes(r.id) && r.status === 'active')
    if (!targets.length) { message.warning('选中的活动中没有"进行中"状态的活动'); return }
    modal.confirm({
      title: `确认批量关闭 ${targets.length} 个许愿活动？`,
      content: '关闭后用户将无法继续许愿，操作不可撤销',
      okText: '确认关闭',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        setBatchLoading(true)
        let ok = 0
        try {
          await Promise.all(targets.map(r =>
            wishApi.closeActivity(r.id).then(() => { ok++ }).catch(() => {})
          ))
          message.success(`已关闭 ${ok} 个活动`)
          setSelectedRowKeys([])
          fetchActivities()
        } finally { setBatchLoading(false) }
      },
    })
  }

  useEffect(() => { fetchActivities() }, [])

  const resetFilters = () => {
    setFTitle(undefined)
    setFActivityStatus(undefined)
    setFCreator(undefined)
    setFItemCount(undefined)
  }

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
    setExpandedRowKeys([])
    setCommentMap({})
  }

  const fetchComments = useCallback(async (itemId: number) => {
    setCommentLoadingSet(prev => new Set(prev).add(itemId))
    try {
      const res: any = await wishApi.getComments(itemId)
      setCommentMap(prev => ({ ...prev, [itemId]: res.data || [] }))
    } finally {
      setCommentLoadingSet(prev => { const s = new Set(prev); s.delete(itemId); return s })
    }
  }, [])

  const handleDeleteComment = async (itemId: number, commentId: number) => {
    try {
      await wishApi.deleteComment(itemId, commentId)
      message.success('评论已删除')
      fetchComments(itemId)
    } catch { /* 统一处理 */ }
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
    {
      title: '活动标题',
      dataIndex: 'title',
      filteredValue: fTitle ? [fTitle] : null,
      filterDropdown: textFilterDropdown('筛选标题', (v) => setFTitle(v)),
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      filteredValue: fActivityStatus ? [fActivityStatus] : null,
      filterDropdown: ({ confirm, clearFilters }: any) => (
        <div style={{ padding: 8 }}>
          <Select
            allowClear
            placeholder="活动状态"
            style={{ width: '100%', marginBottom: 8 }}
            value={fActivityStatus}
            onChange={setFActivityStatus}
            options={[
              { label: '进行中', value: 'active' },
              { label: '已结束', value: 'closed' },
            ]}
          />
          <Space>
            <Button type="primary" size="small" onClick={() => confirm()}>确定</Button>
            <Button size="small" onClick={() => { setFActivityStatus(undefined); clearFilters?.(); confirm() }}>重置</Button>
          </Space>
        </div>
      ),
      render: (v: string) => <Badge status={v === 'active' ? 'processing' : 'default'}
        text={v === 'active' ? '进行中' : '已结束'} />,
    },
    {
      title: '许愿数',
      dataIndex: 'item_count',
      filteredValue: fItemCount != null ? [String(fItemCount)] : null,
      filterDropdown: ({ confirm, clearFilters }: any) => (
        <div style={{ padding: 8 }}>
          <InputNumber min={0} placeholder="精确条数" style={{ width: '100%', marginBottom: 8 }}
            value={fItemCount} onChange={(v) => setFItemCount(v === null ? undefined : Number(v))} />
          <Space>
            <Button type="primary" size="small" onClick={() => confirm()}>确定</Button>
            <Button size="small" onClick={() => { setFItemCount(undefined); clearFilters?.(); confirm() }}>重置</Button>
          </Space>
        </div>
      ),
      sorter: (a: any, b: any) => (a.item_count || 0) - (b.item_count || 0),
      render: (v: number) => <Tag color="blue">{v} 条</Tag>,
    },
    {
      title: '截止时间',
      dataIndex: 'end_at',
      sorter: (a: any, b: any) => dayjs(a.end_at).valueOf() - dayjs(b.end_at).valueOf(),
      render: (v: string) => dayjs(v).format('MM-DD HH:mm'),
    },
    {
      title: '发起人',
      dataIndex: 'creator_name',
      filteredValue: fCreator ? [fCreator] : null,
      filterDropdown: textFilterDropdown('筛选发起人', (v) => setFCreator(v)),
      render: (v: string) => v || '-',
    },
    {
      title: '操作', width: 220, align: 'left' as const,
      render: (_: any, record: any) => (
        <Space size={4} wrap>
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
      title: '排名', width: 60, align: 'center' as const,
      render: (_: any, __: any, i: number) => <Tag color={i < 3 ? 'red' : 'default'}>{i + 1}</Tag>,
    },
    {
      title: '菜品名称',
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
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: '描述',
      dataIndex: 'description',
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
        <div style={{ padding: 8 }}>
          <Input placeholder="筛选描述" value={selectedKeys[0]}
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
        !value || String(r.description || '').toLowerCase().includes(String(value).toLowerCase()),
      render: (v: string) => v || '-',
    },
    {
      title: '点赞数',
      dataIndex: 'vote_count',
      align: 'center' as const,
      sorter: (a: any, b: any) => (a.vote_count || 0) - (b.vote_count || 0),
      render: (v: number) => (
        <Tag color="orange" icon={<LikeOutlined />}>{v} 票</Tag>
      ),
    },
    {
      title: '提交人',
      dataIndex: 'user_name',
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
        <div style={{ padding: 8 }}>
          <Input placeholder="筛选提交人" value={selectedKeys[0]}
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
        !value || String(r.user_name || '').toLowerCase().includes(String(value).toLowerCase()),
    },
    {
      title: '状态',
      dataIndex: 'is_adopted',
      align: 'center' as const,
      filters: [
        { text: '已采纳', value: 1 },
        { text: '未采纳', value: 0 },
      ],
      onFilter: (v: any, r: any) => r.is_adopted === v,
      render: (v: number) => v
        ? <Tag color="green">已采纳</Tag>
        : <Tag>未采纳</Tag>,
    },
    {
      title: '评论',
      dataIndex: 'comment_count',
      align: 'center' as const,
      width: 80,
      render: (v: number, record: any) => (
        <Tooltip title={expandedRowKeys.includes(record.id) ? '收起评论' : '查看评论'}>
          <Button
            size="small"
            type={expandedRowKeys.includes(record.id) ? 'primary' : 'default'}
            icon={<CommentOutlined />}
            onClick={() => {
              const isExpanded = expandedRowKeys.includes(record.id)
              if (isExpanded) {
                setExpandedRowKeys(prev => prev.filter(k => k !== record.id))
              } else {
                setExpandedRowKeys(prev => [...prev, record.id])
                if (commentMap[record.id] === undefined) fetchComments(record.id)
              }
            }}
          >
            {v || 0}
          </Button>
        </Tooltip>
      ),
    },
    {
      title: '操作', width: 88, align: 'left' as const,
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
      <PageListShell
        title="许愿活动管理"
        headerExtra={
          <Space>
            {selectedRowKeys.length > 0 && (
              <>
                <Text type="secondary">
                  已选 <Text strong style={{ color: '#1677ff' }}>{selectedRowKeys.length}</Text> 项
                </Text>
                <Button danger icon={<StopOutlined />} loading={batchLoading}
                  onClick={handleBatchClose}>批量关闭</Button>
              </>
            )}
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setCreateModal(true) }}>
              发起新活动
            </Button>
          </Space>
        }
        filterLeft={
          <>
            <Text type="secondary" style={{ fontSize: 13 }}>标题</Text>
            <Input allowClear placeholder="模糊匹配" style={{ width: 160 }} value={fTitle}
              onChange={e => setFTitle(e.target.value || undefined)} />
            <Text type="secondary" style={{ fontSize: 13 }}>状态</Text>
            <Select allowClear placeholder="全部" style={{ width: 120 }} value={fActivityStatus}
              onChange={setFActivityStatus}
              options={[
                { label: '进行中', value: 'active' },
                { label: '已结束', value: 'closed' },
              ]}
            />
            <Text type="secondary" style={{ fontSize: 13 }}>发起人</Text>
            <Input allowClear placeholder="模糊匹配" style={{ width: 130 }} value={fCreator}
              onChange={e => setFCreator(e.target.value || undefined)} />
            <Text type="secondary" style={{ fontSize: 13 }}>许愿条数</Text>
            <InputNumber min={0} placeholder="精确" style={{ width: 100 }} value={fItemCount}
              onChange={v => setFItemCount(v === null ? undefined : Number(v))} />
          </>
        }
        filterRight={
          <>
            <Button onClick={resetFilters}>重置筛选</Button>
            <Button icon={<ReloadOutlined />} onClick={() => fetchActivities()}>刷新</Button>
          </>
        }
      >
        <Table
          rowKey="id"
          size="middle"
          dataSource={pagedActivities}
          columns={activityColumns}
          loading={loading}
          scroll={{ x: 960 }}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys as number[]),
          }}
          pagination={standardTablePagination({
            current: page,
            total: filteredActivities.length,
            pageSize,
            onChange: (p, ps) => { setPage(p); setPageSize(ps) },
          })}
        />
      </PageListShell>

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
        width={880}
      >
        <Table
          rowKey="id"
          dataSource={wishItems}
          columns={itemColumns}
          pagination={false}
          size="small"
          scroll={{ x: 900 }}
          expandable={{
            expandedRowKeys,
            showExpandColumn: false,
            expandedRowRender: (record: any) => {
              const comments = commentMap[record.id]
              const isLoading = commentLoadingSet.has(record.id)
              if (isLoading) return <div style={{ padding: '12px 0', textAlign: 'center' }}><Spin size="small" /></div>
              if (!comments || comments.length === 0) return (
                <div style={{ padding: '12px 24px', color: '#94A3B8', fontSize: 13 }}>暂无评论</div>
              )
              return (
                <List
                  size="small"
                  style={{ padding: '4px 24px 8px', background: '#FAFAFA', borderRadius: 6 }}
                  dataSource={comments}
                  renderItem={(c: any) => (
                    <List.Item
                      style={{ padding: '6px 0' }}
                      actions={[
                        <Popconfirm
                          key="del"
                          title="确认删除此评论？"
                          onConfirm={() => handleDeleteComment(record.id, c.id)}
                          okText="删除"
                          okButtonProps={{ danger: true }}
                        >
                          <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                      ]}
                    >
                      <List.Item.Meta
                        avatar={<Avatar size={24} icon={<UserOutlined />} style={{ background: '#E2E8F0', color: '#64748B' }} />}
                        title={
                          <Space size={6}>
                            <span style={{ fontWeight: 500, fontSize: 13 }}>{c.user_name || '用户'}</span>
                            <span style={{ color: '#94A3B8', fontSize: 11, fontWeight: 400 }}>
                              {new Date(c.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </Space>
                        }
                        description={<span style={{ color: '#334155', fontSize: 13 }}>{c.content}</span>}
                      />
                    </List.Item>
                  )}
                />
              )
            },
          }}
        />
      </Modal>

      <Modal title="采纳许愿菜品" open={!!adoptModal} onOk={handleAdopt}
        onCancel={() => setAdoptModal(null)} okText="确认采纳">
        {adoptModal && (
          <>
            <Descriptions
              column={1}
              bordered
              labelStyle={{ color: '#64748B', fontWeight: 500, width: 80, whiteSpace: 'nowrap' }}
              contentStyle={{ color: '#0F172A' }}
              style={{ marginBottom: 20 }}
            >
              <Descriptions.Item label="菜品名称">{adoptModal.dish_name}</Descriptions.Item>
              <Descriptions.Item label="描述">{adoptModal.description || '-'}</Descriptions.Item>
              <Descriptions.Item label="点赞数">{adoptModal.vote_count} 票</Descriptions.Item>
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
