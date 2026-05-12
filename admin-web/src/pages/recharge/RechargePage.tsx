import { useState, useEffect } from 'react'
import { Table, Tag, Button, Modal, Image, Form, Input, Select, Space, message, Typography, Descriptions, App } from 'antd'
import { CheckOutlined, CloseOutlined, ReloadOutlined, CheckCircleOutlined } from '@ant-design/icons'
import PageListShell, { standardTablePagination } from '../../components/PageListShell'
import { textFilterDropdown } from '../../utils/tableColumnFilters'
import { adminApi } from '../../api/admin'
import dayjs from 'dayjs'

const { Text } = Typography
const { Option } = Select

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: '待处理', color: 'gold' },
  completed: { label: '已完成', color: 'green' },
  rejected: { label: '已驳回', color: 'red' },
}

export default function RechargePage() {
  const { modal } = App.useApp()

  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [filterStatus, setFilterStatus] = useState<string | undefined>('pending')
  const [reviewModal, setReviewModal] = useState<any>(null)
  const [reviewAction, setReviewAction] = useState<'completed' | 'rejected'>('completed')
  const [form] = Form.useForm()

  const [colUserName, setColUserName] = useState<string | undefined>()
  const [colCompanyName, setColCompanyName] = useState<string | undefined>()
  const [colRemark, setColRemark] = useState<string | undefined>()
  const [rechargeListFilterKey, setRechargeListFilterKey] = useState(0)
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([])
  const [batchLoading, setBatchLoading] = useState(false)

  const resetRechargeFilters = () => {
    setFilterStatus(undefined)
    setColUserName(undefined)
    setColCompanyName(undefined)
    setColRemark(undefined)
    setRechargeListFilterKey(k => k + 1)
    setPage(1)
  }

  const handleBatchApprove = () => {
    const targets = data.filter(r => selectedRowKeys.includes(r.id) && r.status === 'pending')
    if (!targets.length) { message.warning('选中的记录中没有"待处理"状态的充值申请'); return }
    const total = targets.reduce((s, r) => s + Number(r.amount), 0)
    modal.confirm({
      title: `确认批量完成 ${targets.length} 笔充值申请？`,
      content: `合计金额 ¥${total.toFixed(2)}，操作不可撤销`,
      okText: '确认完成',
      cancelText: '取消',
      onOk: async () => {
        setBatchLoading(true)
        let ok = 0
        try {
          await Promise.all(targets.map(r =>
            adminApi.reviewRecharge(r.id, { status: 'completed', review_note: '' })
              .then(() => { ok++ }).catch(() => {})
          ))
          message.success(`已完成 ${ok} 笔充值`)
          setSelectedRowKeys([])
          fetchData(page, pageSize)
        } finally { setBatchLoading(false) }
      },
    })
  }

  const fetchData = async (p = 1, ps = pageSize) => {
    setLoading(true)
    setSelectedRowKeys([])
    try {
      const res: any = await adminApi.getRecharges({
        page: p,
        page_size: ps,
        status: filterStatus || undefined,
        user_name: colUserName,
        company_name: colCompanyName,
        remark: colRemark,
      })
      setData(res.data.list)
      setTotal(res.data.total)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData(page, pageSize)
  }, [page, pageSize, filterStatus, colUserName, colCompanyName, colRemark])

  const openReview = (record: any, action: 'completed' | 'rejected') => {
    setReviewModal(record)
    setReviewAction(action)
    form.resetFields()
  }

  const handleReview = async () => {
    const values = await form.validateFields()
    try {
      await adminApi.reviewRecharge(reviewModal.id, { status: reviewAction, review_note: values.review_note || '' })
      message.success(reviewAction === 'completed' ? '已标记充值完成' : '已驳回申请')
      setReviewModal(null)
      fetchData(page, pageSize)
    } catch { /* 统一处理 */ }
  }

  const statusOptions = Object.entries(STATUS_MAP).map(([value, { label }]) => ({ label, value }))

  const columns = [
    {
      title: '用户',
      dataIndex: 'user_name',
      filteredValue: colUserName ? [colUserName] : null,
      filterDropdown: textFilterDropdown('搜索用户', (v) => { setColUserName(v); setPage(1) }),
    },
    {
      title: '公司',
      dataIndex: 'company_name',
      filteredValue: colCompanyName ? [colCompanyName] : null,
      filterDropdown: textFilterDropdown('搜索公司', (v) => { setColCompanyName(v); setPage(1) }),
      render: (v: string) => v || '-',
    },
    {
      title: '充值金额',
      dataIndex: 'amount',
      align: 'right' as const,
      sorter: (a: any, b: any) => Number(a.amount) - Number(b.amount),
      render: (v: string) => <Text strong>¥{Number(v).toFixed(2)}</Text>,
    },
    {
      title: '凭证',
      dataIndex: 'proof_image_url',
      align: 'center' as const,
      filters: [
        { text: '有凭证', value: '1' },
        { text: '无凭证', value: '0' },
      ],
      onFilter: (v: any, r: any) =>
        v === '1' ? !!r.proof_image_url : v === '0' ? !r.proof_image_url : true,
      render: (v: string) => v ? <Image src={v} width={48} height={48} style={{ borderRadius: 6, objectFit: 'cover' }} /> : '-',
    },
    {
      title: '备注',
      dataIndex: 'remark',
      filteredValue: colRemark ? [colRemark] : null,
      filterDropdown: textFilterDropdown('搜索备注', (v) => { setColRemark(v); setPage(1) }),
      render: (v: string) => v || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      filteredValue: filterStatus ? [filterStatus] : null,
      filterDropdown: ({ confirm, clearFilters }: any) => (
        <div style={{ padding: 8 }}>
          <Select
            allowClear
            placeholder="状态"
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
      title: '申请时间',
      dataIndex: 'created_at',
      sorter: (a: any, b: any) => dayjs(a.created_at).valueOf() - dayjs(b.created_at).valueOf(),
      render: (v: string) => dayjs(v).format('MM-DD HH:mm'),
    },
    {
      title: '操作', width: 160, align: 'left' as const,
      render: (_: any, record: any) => record.status === 'pending' ? (
        <Space size={4}>
          <Button size="small" icon={<CheckOutlined />}
            onClick={() => openReview(record, 'completed')}>完成</Button>
          <Button size="small" danger icon={<CloseOutlined />}
            onClick={() => openReview(record, 'rejected')}>驳回</Button>
        </Space>
      ) : (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {record.reviewer_name} · {dayjs(record.reviewed_at).format('MM-DD HH:mm')}
        </Text>
      ),
    },
  ]

  return (
    <div>
      <PageListShell
        title="饭卡充值审核"
        filterLeft={
          <>
            <Text type="secondary" style={{ fontSize: 13 }}>状态</Text>
            <Select value={filterStatus} onChange={(v) => { setFilterStatus(v); setPage(1) }} style={{ width: 120 }} allowClear placeholder="全部">
              {Object.entries(STATUS_MAP).map(([k, v]) => <Option key={k} value={k}>{v.label}</Option>)}
            </Select>
            <Text type="secondary" style={{ fontSize: 13 }}>用户</Text>
            <Input.Search key={`r-lk-${rechargeListFilterKey}-u`} placeholder="昵称" allowClear style={{ width: 130 }}
              onSearch={(v) => { setColUserName(v || undefined); setPage(1) }} />
            <Text type="secondary" style={{ fontSize: 13 }}>公司</Text>
            <Input.Search key={`r-lk-${rechargeListFilterKey}-c`} placeholder="名称" allowClear style={{ width: 140 }}
              onSearch={(v) => { setColCompanyName(v || undefined); setPage(1) }} />
            <Text type="secondary" style={{ fontSize: 13 }}>备注</Text>
            <Input.Search key={`r-lk-${rechargeListFilterKey}-m`} placeholder="模糊" allowClear style={{ width: 140 }}
              onSearch={(v) => { setColRemark(v || undefined); setPage(1) }} />
          </>
        }
        headerExtra={
          selectedRowKeys.length > 0 ? (
            <Space>
              <Text type="secondary">
                已选 <Text strong style={{ color: '#1677ff' }}>{selectedRowKeys.length}</Text> 项
              </Text>
              <Button icon={<CheckCircleOutlined />} loading={batchLoading}
                onClick={handleBatchApprove}>批量完成</Button>
            </Space>
          ) : undefined
        }
        filterRight={
          <>
            <Button onClick={resetRechargeFilters}>重置筛选</Button>
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
          scroll={{ x: 1200 }}
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
        title={reviewAction === 'completed' ? '标记充值完成' : '驳回充值申请'}
        open={!!reviewModal}
        onOk={handleReview}
        onCancel={() => setReviewModal(null)}
        okText="确认"
        okButtonProps={{ danger: reviewAction === 'rejected' }}
      >
        {reviewModal && (
          <>
            <Descriptions size="small" column={1} style={{ marginBottom: 12 }}>
              <Descriptions.Item label="用户">{reviewModal.user_name} · {reviewModal.company_name}</Descriptions.Item>
              <Descriptions.Item label="充值金额">
                <Text strong style={{ color: '#52c41a' }}>¥{Number(reviewModal.amount).toFixed(2)}</Text>
              </Descriptions.Item>
              {reviewModal.remark && <Descriptions.Item label="用户备注">{reviewModal.remark}</Descriptions.Item>}
              {reviewModal.proof_image_url && (
                <Descriptions.Item label="转账凭证">
                  <Image src={reviewModal.proof_image_url} width={120} />
                </Descriptions.Item>
              )}
            </Descriptions>
            <Form form={form} layout="vertical">
              <Form.Item name="review_note" label="审核备注（选填）">
                <Input.TextArea rows={2} placeholder={reviewAction === 'rejected' ? '请填写驳回原因' : '可填写处理说明'} />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>
    </div>
  )
}
