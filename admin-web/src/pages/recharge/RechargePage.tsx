import { useState, useEffect } from 'react'
import { Table, Tag, Button, Modal, Image, Form, Input, Select, Space, message, Typography, Descriptions } from 'antd'
import { CheckOutlined, CloseOutlined } from '@ant-design/icons'
import { adminApi } from '../../api/admin'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { Option } = Select

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: '待处理', color: 'gold' },
  completed: { label: '已完成', color: 'green' },
  rejected: { label: '已驳回', color: 'red' },
}

export default function RechargePage() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [filterStatus, setFilterStatus] = useState<string>('pending')
  const [reviewModal, setReviewModal] = useState<any>(null)
  const [reviewAction, setReviewAction] = useState<'completed' | 'rejected'>('completed')
  const [form] = Form.useForm()

  const fetchData = async (p = 1) => {
    setLoading(true)
    try {
      const res: any = await adminApi.getRecharges({ page: p, page_size: 15, status: filterStatus || undefined })
      setData(res.data.list)
      setTotal(res.data.total)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData(1); setPage(1) }, [filterStatus])

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
      fetchData(page)
    } catch { /* 统一处理 */ }
  }

  const columns = [
    { title: '用户', dataIndex: 'user_name' },
    { title: '公司', dataIndex: 'company_name', render: (v: string) => v || '-' },
    {
      title: '充值金额', dataIndex: 'amount',
      render: (v: string) => <Text strong style={{ color: '#52c41a' }}>¥{Number(v).toFixed(2)}</Text>,
    },
    {
      title: '凭证', dataIndex: 'proof_image_url',
      render: (v: string) => v ? <Image src={v} width={48} height={48} style={{ borderRadius: 4, objectFit: 'cover' }} /> : '-',
    },
    { title: '备注', dataIndex: 'remark', render: (v: string) => v || '-' },
    {
      title: '状态', dataIndex: 'status',
      render: (v: string) => <Tag color={STATUS_MAP[v]?.color}>{STATUS_MAP[v]?.label}</Tag>,
    },
    { title: '申请时间', dataIndex: 'created_at', render: (v: string) => dayjs(v).format('MM-DD HH:mm') },
    {
      title: '操作',
      render: (_: any, record: any) => record.status === 'pending' ? (
        <Space>
          <Button size="small" type="primary" icon={<CheckOutlined />}
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
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>饭卡充值审核</Title>
      </div>

      <Space style={{ marginBottom: 12 }}>
        <Select value={filterStatus} onChange={setFilterStatus} style={{ width: 120 }} allowClear placeholder="全部状态">
          {Object.entries(STATUS_MAP).map(([k, v]) => <Option key={k} value={k}>{v.label}</Option>)}
        </Select>
        <Button onClick={() => fetchData(page)}>刷新</Button>
      </Space>

      <Table rowKey="id" dataSource={data} columns={columns} loading={loading}
        pagination={{ current: page, total, pageSize: 15, onChange: (p) => { setPage(p); fetchData(p) } }}
      />

      <Modal
        title={reviewAction === 'completed' ? '✅ 标记充值完成' : '❌ 驳回充值申请'}
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
