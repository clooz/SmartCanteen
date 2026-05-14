import { useState, useEffect, useMemo } from 'react'
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  message,
  Space,
  Typography,
  Tag,
  Switch,
  Select,
  Popconfirm,
  Tooltip,
} from 'antd'
import { PlusOutlined, EditOutlined, ReloadOutlined, DeleteOutlined } from '@ant-design/icons'
import PageListShell, { standardTablePagination } from '../../components/PageListShell'
import { textFilterDropdown } from '../../utils/tableColumnFilters'
import { tableListLocale, TableLoadErrorAlert } from '../../utils/tableListLocale'
import { adminApi } from '../../api/admin'

const { Text } = Typography

export default function CompaniesPage() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalSubmitting, setModalSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form] = Form.useForm()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [loadError, setLoadError] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const [fCode, setFCode] = useState<string | undefined>()
  const [fName, setFName] = useState<string | undefined>()
  const [fMember, setFMember] = useState<number | undefined>()
  const [fActive, setFActive] = useState<string | undefined>()

  const filteredData = useMemo(() => {
    return data.filter((row) => {
      if (fCode && !String(row.code || '').toLowerCase().includes(fCode.toLowerCase())) return false
      if (fName && !String(row.name || '').toLowerCase().includes(fName.toLowerCase())) return false
      if (fMember != null && !Number.isNaN(fMember) && Number(row.member_count) !== fMember) return false
      if (fActive === '1' && Number(row.is_active) !== 1) return false
      if (fActive === '0' && Number(row.is_active) === 1) return false
      return true
    })
  }, [data, fCode, fName, fMember, fActive])

  const pagedData = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredData.slice(start, start + pageSize)
  }, [filteredData, page, pageSize])

  const fetchData = async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const res: any = await adminApi.getCompanies()
      setData(res.data || [])
      setPage(1)
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  useEffect(() => {
    setPage(1)
  }, [fCode, fName, fMember, fActive])

  const openCreate = () => {
    setEditingId(null)
    form.resetFields()
    setModalOpen(true)
  }

  const openEdit = (record: any) => {
    setEditingId(record.id)
    form.setFieldsValue({
      name: record.name,
      code: record.code,
      contact_name: record.contact_name ?? '',
      contact_phone: record.contact_phone ?? '',
      address: record.address ?? '',
      remark: record.remark ?? '',
      credit_code: record.credit_code ?? '',
      is_active: record.is_active !== 0,
    })
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    const values = await form.validateFields()
    setModalSubmitting(true)
    try {
      const detail = {
        name: values.name,
        contact_name: values.contact_name,
        contact_phone: values.contact_phone,
        address: values.address,
        remark: values.remark,
        credit_code: values.credit_code,
        is_active: values.is_active,
      }
      if (editingId === null) {
        await adminApi.createCompany({ ...detail, code: values.code })
        message.success('公司已创建')
      } else {
        await adminApi.updateCompany(editingId, detail)
        message.success('公司信息已更新')
      }
      setModalOpen(false)
      fetchData()
    } catch { /* 统一处理 */ }
    finally {
      setModalSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    setDeletingId(id)
    try {
      await adminApi.deleteCompany(id)
      message.success('公司已删除')
      fetchData()
    } catch {
      /* 拦截器已提示 */
    } finally {
      setDeletingId(null)
    }
  }

  const resetFilters = () => {
    setFCode(undefined)
    setFName(undefined)
    setFMember(undefined)
    setFActive(undefined)
  }

  const ellipsis = (text: string | null | undefined, max = 24) => {
    const s = text == null ? '' : String(text)
    if (!s) return '—'
    return (
      <span title={s}>{s.length > max ? `${s.slice(0, max)}…` : s}</span>
    )
  }

  const columns = [
    {
      title: '公司编码',
      dataIndex: 'code',
      width: 120,
      filteredValue: fCode ? [fCode] : null,
      filterDropdown: textFilterDropdown('筛选编码', (v) => setFCode(v)),
    },
    {
      title: '公司名称',
      dataIndex: 'name',
      width: 160,
      filteredValue: fName ? [fName] : null,
      filterDropdown: textFilterDropdown('筛选名称', (v) => setFName(v)),
    },
    {
      title: '联系人',
      dataIndex: 'contact_name',
      width: 100,
      render: (v: string) => ellipsis(v, 12),
    },
    {
      title: '联系电话',
      dataIndex: 'contact_phone',
      width: 130,
      render: (v: string) => v || '—',
    },
    {
      title: '地址',
      dataIndex: 'address',
      width: 200,
      render: (v: string) => ellipsis(v, 28),
    },
    {
      title: '统一社会信用代码',
      dataIndex: 'credit_code',
      width: 170,
      render: (v: string) => ellipsis(v, 14),
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      width: 88,
      filteredValue: fActive ? [fActive] : null,
      filterDropdown: ({ confirm, clearFilters }: any) => (
        <div style={{ padding: 8 }}>
          <Select
            allowClear
            placeholder="状态"
            style={{ width: '100%', marginBottom: 8 }}
            value={fActive}
            onChange={(v) => setFActive(v)}
            options={[
              { value: '1', label: '启用' },
              { value: '0', label: '停用' },
            ]}
          />
          <Space>
            <Button type="primary" size="small" onClick={() => confirm()}>确定</Button>
            <Button size="small" onClick={() => { setFActive(undefined); clearFilters?.(); confirm() }}>重置</Button>
          </Space>
        </div>
      ),
      onFilter: () => true,
      render: (v: number) =>
        v === 0 ? <Tag color="default">停用</Tag> : <Tag color="success">启用</Tag>,
    },
    {
      title: '员工人数',
      dataIndex: 'member_count',
      width: 120,
      align: 'right' as const,
      filteredValue: fMember != null ? [String(fMember)] : null,
      filterDropdown: ({ confirm, clearFilters }: any) => (
        <div style={{ padding: 8 }}>
          <InputNumber min={0} placeholder="精确人数" style={{ width: '100%', marginBottom: 8 }}
            value={fMember} onChange={(v) => setFMember(v === null ? undefined : Number(v))} />
          <Space>
            <Button type="primary" size="small" onClick={() => confirm()}>确定</Button>
            <Button size="small" onClick={() => { setFMember(undefined); clearFilters?.(); confirm() }}>重置</Button>
          </Space>
        </div>
      ),
      onFilter: (v: any, r: any) => (v == null || v === '' ? true : Number(r.member_count) === Number(v)),
    },
    {
      title: '备注',
      dataIndex: 'remark',
      width: 160,
      render: (v: string) => ellipsis(v, 20),
    },
    {
      title: '操作',
      width: 168,
      align: 'left' as const,
      fixed: 'right' as const,
      render: (_: any, record: any) => {
        const memberN = Number(record.member_count)
        const canDelete = memberN === 0 && !Number.isNaN(memberN)
        return (
          <Space size="small">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>编辑</Button>
            {canDelete ? (
              <Popconfirm
                title="确定删除该公司？"
                description="删除后不可恢复。厨师/管理员若关联该公司，其「所属公司」将被清空。"
                okText="删除"
                okButtonProps={{ danger: true }}
                cancelText="取消"
                onConfirm={() => handleDelete(record.id)}
              >
                <Button
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  loading={deletingId === record.id}
                >
                  删除
                </Button>
              </Popconfirm>
            ) : (
              <Tooltip title="仅当公司员工（角色为员工）人数为 0 时可删除">
                <span>
                  <Button size="small" danger icon={<DeleteOutlined />} disabled>
                    删除
                  </Button>
                </span>
              </Tooltip>
            )}
          </Space>
        )
      },
    },
  ]

  return (
    <div>
      <PageListShell
        title="公司管理"
        headerExtra={<Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增公司</Button>}
        filterLeft={
          <>
            <Text type="secondary" style={{ fontSize: 13 }}>编码</Text>
            <Input allowClear placeholder="模糊匹配" style={{ width: 140 }} value={fCode}
              onChange={e => setFCode(e.target.value || undefined)} />
            <Text type="secondary" style={{ fontSize: 13 }}>名称</Text>
            <Input allowClear placeholder="模糊匹配" style={{ width: 180 }} value={fName}
              onChange={e => setFName(e.target.value || undefined)} />
            <Text type="secondary" style={{ fontSize: 13 }}>人数</Text>
            <InputNumber min={0} placeholder="精确" style={{ width: 100 }} value={fMember}
              onChange={v => setFMember(v === null ? undefined : Number(v))} />
            <Text type="secondary" style={{ fontSize: 13 }}>状态</Text>
            <Select allowClear placeholder="全部" style={{ width: 100 }} value={fActive}
              onChange={(v) => setFActive(v)}
              options={[{ value: '1', label: '启用' }, { value: '0', label: '停用' }]} />
          </>
        }
        filterRight={
          <>
            <Button onClick={resetFilters}>重置筛选</Button>
            <Button icon={<ReloadOutlined />} onClick={() => fetchData()}>刷新</Button>
          </>
        }
      >
        <TableLoadErrorAlert error={loadError} onRetry={() => fetchData()} />
        <Table
          rowKey="id"
          size="middle"
          dataSource={pagedData}
          columns={columns}
          loading={loading}
          scroll={{ x: 1280 }}
          locale={tableListLocale}
          pagination={standardTablePagination({
            current: page,
            total: filteredData.length,
            pageSize,
            onChange: (p, ps) => { setPage(p); setPageSize(ps) },
          })}
        />
      </PageListShell>

      <Modal title={editingId ? '编辑公司' : '新增公司'} open={modalOpen} destroyOnClose
        onOk={handleSubmit} onCancel={() => setModalOpen(false)} okText="保存" confirmLoading={modalSubmitting}>
        <Form form={form} layout="vertical" initialValues={{ is_active: true }}>
          <Form.Item name="name" label="公司名称" rules={[{ required: true }]}>
            <Input maxLength={100} />
          </Form.Item>
          {!editingId && (
            <Form.Item name="code" label="公司编码（如 E、F）" rules={[{ required: true }]}>
              <Input maxLength={10} style={{ textTransform: 'uppercase' }} />
            </Form.Item>
          )}
          <Form.Item name="contact_name" label="联系人">
            <Input maxLength={50} allowClear placeholder="选填" />
          </Form.Item>
          <Form.Item name="contact_phone" label="联系电话">
            <Input maxLength={30} allowClear placeholder="手机或座机" />
          </Form.Item>
          <Form.Item name="address" label="办公地址">
            <Input maxLength={255} allowClear placeholder="选填" />
          </Form.Item>
          <Form.Item name="credit_code" label="统一社会信用代码">
            <Input maxLength={32} allowClear placeholder="选填" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} maxLength={500} showCount allowClear placeholder="选填" />
          </Form.Item>
          <Form.Item name="is_active" label="启用" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
