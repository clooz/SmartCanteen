import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Table, Button, Tag, Modal, Form, Input, DatePicker, Space,
  message, Typography, Popconfirm, Badge, InputNumber, Select, App, List, Avatar, Spin, Collapse, Empty,
} from 'antd'
import { PlusOutlined, TrophyOutlined, LikeOutlined, ReloadOutlined, StopOutlined, DeleteOutlined, UserOutlined, SearchOutlined, PlayCircleOutlined, EditOutlined } from '@ant-design/icons'
import './WishPage.css'
import PageListShell, { standardTablePagination } from '../../components/PageListShell'
import { textFilterDropdown } from '../../utils/tableColumnFilters'
import { tableListLocale, TableLoadErrorAlert } from '../../utils/tableListLocale'
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
  const [editModal, setEditModal] = useState<any>(null)
  const [editForm] = Form.useForm()
  const [itemsModal, setItemsModal] = useState<any>(null)
  const [wishItems, setWishItems] = useState<any[]>([])
  const [rankFilter, setRankFilter] = useState('')
  const [commentPanelKeys, setCommentPanelKeys] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [fTitle, setFTitle] = useState<string | undefined>()
  const [fActivityStatus, setFActivityStatus] = useState<string | undefined>()
  const [fCreator, setFCreator] = useState<string | undefined>()
  const [fItemCount, setFItemCount] = useState<number | undefined>()
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([])
  const [batchLoading, setBatchLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [editSubmitting, setEditSubmitting] = useState(false)
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
    setLoadError(false)
    try {
      const res: any = await wishApi.getActivities()
      setActivities(res.data || [])
      setPage(1)
    } catch {
      setLoadError(true)
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

  const handleBatchReopen = () => {
    const targets = pagedActivities.filter(r => selectedRowKeys.includes(r.id) && r.status === 'closed')
    if (!targets.length) {
      message.warning('选中的活动中没有「已结束」状态的活动')
      return
    }
    modal.confirm({
      title: `确认重新开启选中的 ${targets.length} 个许愿活动？`,
      content: '开启后员工可继续许愿、投票与评论。若某活动截止时间已过，系统将自动把截止时间顺延 7 天。',
      okText: '确认开启',
      cancelText: '取消',
      onOk: async () => {
        setBatchLoading(true)
        let ok = 0
        try {
          await Promise.all(targets.map(r =>
            wishApi.reopenActivity(r.id).then(() => { ok++ }).catch(() => {})
          ))
          message.success(`已重新开启 ${ok} 个活动`)
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
    setCreateSubmitting(true)
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
    finally {
      setCreateSubmitting(false)
    }
  }

  const openEdit = (record: any) => {
    setEditModal(record)
    editForm.setFieldsValue({
      title: record.title,
      description: record.description ?? '',
      dateRange: [dayjs(record.start_at), dayjs(record.end_at)],
    })
  }

  const handleEditSave = async () => {
    if (!editModal) return
    const activityId = editModal.id
    const values = await editForm.validateFields()
    setEditSubmitting(true)
    try {
      await wishApi.updateActivity(activityId, {
        title: values.title,
        description: values.description,
        start_at: values.dateRange[0].toISOString(),
        end_at: values.dateRange[1].toISOString(),
      })
      message.success('活动已更新')
      setEditModal(null)
      editForm.resetFields()
      fetchActivities()
      if (itemsModal?.id === activityId) {
        setItemsModal((prev: any) => (prev ? { ...prev, title: values.title } : null))
      }
    } catch { /* 统一处理 */ }
    finally {
      setEditSubmitting(false)
    }
  }

  const handleClose = async (id: number) => {
    try {
      await wishApi.closeActivity(id)
      message.success('活动已关闭')
      fetchActivities()
    } catch { /* 统一处理 */ }
  }

  const handleReopen = async (id: number) => {
    try {
      const res: any = await wishApi.reopenActivity(id)
      message.success(res?.message || '活动已重新开启')
      fetchActivities()
    } catch { /* 统一处理 */ }
  }

  const openItems = async (activity: any) => {
    const res: any = await wishApi.getItems(activity.id)
    setWishItems(res.data || [])
    setItemsModal(activity)
    setCommentPanelKeys([])
    setRankFilter('')
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

  const filteredWishItems = useMemo(() => {
    const q = rankFilter.trim().toLowerCase()
    if (!q) return wishItems
    return wishItems.filter((it) =>
      String(it.dish_name || '').toLowerCase().includes(q) ||
      String(it.description || '').toLowerCase().includes(q) ||
      String(it.user_name || '').toLowerCase().includes(q)
    )
  }, [wishItems, rankFilter])

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
      title: '操作', width: 380, align: 'left' as const,
      render: (_: any, record: any) => (
        <Space size={4} wrap>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>编辑</Button>
          <Button size="small" icon={<TrophyOutlined />} onClick={() => openItems(record)}>查看排行</Button>
          {record.status === 'active' && (
            <Popconfirm title="确认关闭活动？" onConfirm={() => handleClose(record.id)}>
              <Button size="small" danger>关闭</Button>
            </Popconfirm>
          )}
          {record.status === 'closed' && (
            <Popconfirm
              title="确认重新开启该活动？"
              description="开启后员工可继续许愿、投票与评论。若截止时间已过，将自动顺延 7 天。"
              onConfirm={() => handleReopen(record.id)}
              okText="开启"
            >
              <Button size="small" type="primary" ghost icon={<PlayCircleOutlined />}>
                重新开启
              </Button>
            </Popconfirm>
          )}
        </Space>
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
                <Button type="primary" ghost icon={<PlayCircleOutlined />} loading={batchLoading}
                  onClick={handleBatchReopen}>批量开启</Button>
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
        <TableLoadErrorAlert error={loadError} onRetry={() => fetchActivities()} />
        <Table
          rowKey="id"
          size="middle"
          dataSource={pagedActivities}
          columns={activityColumns}
          loading={loading}
          locale={tableListLocale}
          scroll={{ x: 1080 }}
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

      <Modal title="发起许愿活动" open={createModal} destroyOnClose onOk={handleCreate} onCancel={() => setCreateModal(false)} okText="发起" confirmLoading={createSubmitting}>
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
        title="编辑许愿活动"
        open={!!editModal}
        onOk={handleEditSave}
        onCancel={() => { setEditModal(null); editForm.resetFields() }}
        okText="保存"
        destroyOnClose
        confirmLoading={editSubmitting}
      >
        <Form form={editForm} layout="vertical">
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
        className="wish-rank-modal"
        title={`「${itemsModal?.title}」许愿排行榜`}
        open={!!itemsModal}
        onCancel={() => {
          setItemsModal(null)
          setCommentPanelKeys([])
          setRankFilter('')
        }}
        footer={null}
        width={680}
        destroyOnClose
      >
        <div className="wish-rank-toolbar">
          <Input
            allowClear
            prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
            placeholder="筛选菜品、描述或提交人"
            value={rankFilter}
            onChange={(e) => setRankFilter(e.target.value)}
          />
        </div>
        <div className="wish-rank-scroll">
          {!wishItems.length ? (
            <Empty description="暂无许愿条目" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : !filteredWishItems.length ? (
            <Empty description="没有符合筛选条件的条目" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <Collapse
              className="wish-rank-collapse"
              bordered={false}
              expandIconPosition="end"
              activeKey={commentPanelKeys}
              onChange={(key) => {
                const keys = (Array.isArray(key) ? key : [key]).filter(Boolean) as string[]
                setCommentPanelKeys(keys)
                keys.forEach((k) => {
                  const id = Number(k)
                  if (!Number.isNaN(id) && commentMap[id] === undefined) {
                    fetchComments(id)
                  }
                })
              }}
              items={filteredWishItems.map((item, idx) => {
                const badgeExtra = idx === 0 ? 'wish-rank-badge--1' : idx === 1 ? 'wish-rank-badge--2' : idx === 2 ? 'wish-rank-badge--3' : ''
                return {
                  key: String(item.id),
                  label: (
                    <div className="wish-rank-collapse__label">
                      <div className={`wish-rank-badge ${badgeExtra}`.trim()}>
                        {idx + 1}
                      </div>
                      <div className="wish-rank-main">
                        <div className="wish-rank-title-row">
                          <span className="wish-rank-dish-name">{item.dish_name}</span>
                          <Tag color="orange" icon={<LikeOutlined style={{ fontSize: 12 }} />}>
                            {item.vote_count ?? 0} 票
                          </Tag>
                        </div>
                        {item.description ? (
                          <div className="wish-rank-desc">{item.description}</div>
                        ) : null}
                        <div className="wish-rank-meta">
                          <UserOutlined style={{ marginRight: 4 }} />
                          提交人：{item.user_name || '—'}
                          {(item.comment_count ?? 0) > 0 ? (
                            <span style={{ marginLeft: 10 }}>
                              · {item.comment_count} 条评论
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ),
                  children: (() => {
                    const isLoading = commentLoadingSet.has(item.id)
                    const comments = commentMap[item.id]
                    if (isLoading && comments === undefined) {
                      return <div className="wish-rank-spin"><Spin /></div>
                    }
                    if (!comments || comments.length === 0) {
                      return <div className="wish-rank-comments-empty">暂无评论</div>
                    }
                    return (
                      <div className="wish-rank-comments">
                        <List
                          size="small"
                          dataSource={comments}
                          renderItem={(c: any) => (
                            <List.Item
                              style={{ borderBlockEnd: 'none' }}
                              actions={[
                                <Popconfirm
                                  key="del"
                                  title="确认删除此评论？"
                                  onConfirm={() => handleDeleteComment(item.id, c.id)}
                                  okText="删除"
                                  okButtonProps={{ danger: true }}
                                >
                                  <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                                </Popconfirm>,
                              ]}
                            >
                              <List.Item.Meta
                                avatar={<Avatar size={28} icon={<UserOutlined />} style={{ background: '#e2e8f0', color: '#64748b' }} />}
                                title={
                                  <Space size={8} wrap>
                                    <span style={{ fontWeight: 600 }}>{c.user_name || '用户'}</span>
                                    <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 400 }}>
                                      {new Date(c.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </Space>
                                }
                                description={<span style={{ color: '#334155', fontSize: 13 }}>{c.content}</span>}
                              />
                            </List.Item>
                          )}
                        />
                      </div>
                    )
                  })(),
                }
              })
            }
          />
          )}
        </div>
      </Modal>
    </div>
  )
}
