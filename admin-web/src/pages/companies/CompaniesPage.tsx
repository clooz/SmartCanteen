import { useState, useEffect, useMemo } from 'react'
import { Table, Button, Modal, Form, Input, InputNumber, message, Space, Typography } from 'antd'
import { PlusOutlined, EditOutlined, ReloadOutlined } from '@ant-design/icons'
import PageListShell, { standardTablePagination } from '../../components/PageListShell'
import { textFilterDropdown } from '../../utils/tableColumnFilters'
import { adminApi } from '../../api/admin'

const { Text } = Typography

export default function CompaniesPage() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form] = Form.useForm()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [fCode, setFCode] = useState<string | undefined>()
  const [fName, setFName] = useState<string | undefined>()
  const [fMember, setFMember] = useState<number | undefined>()

  const filteredData = useMemo(() => {
    return data.filter((row) => {
      if (fCode && !String(row.code || '').toLowerCase().includes(fCode.toLowerCase())) return false
      if (fName && !String(row.name || '').toLowerCase().includes(fName.toLowerCase())) return false
      if (fMember != null && !Number.isNaN(fMember) && Number(row.member_count) !== fMember) return false
      return true
    })
  }, [data, fCode, fName, fMember])

  const pagedData = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredData.slice(start, start + pageSize)
  }, [filteredData, page, pageSize])

  const fetchData = async () => {
    setLoading(true)
    try {
      const res: any = await adminApi.getCompanies()
      setData(res.data || [])
      setPage(1)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  useEffect(() => {
    setPage(1)
  }, [fCode, fName, fMember])

  const openCreate = () => {
    setEditingId(null)
    form.resetFields()
    setModalOpen(true)
  }

  const openEdit = (record: any) => {
    setEditingId(record.id)
    form.setFieldsValue({ name: record.name, code: record.code })
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    const values = await form.validateFields()
    try {
      if (editingId === null) {
        await adminApi.createCompany(values)
        message.success('公司已创建')
      } else {
        await adminApi.updateCompany(editingId, { name: values.name })
        message.success('公司信息已更新')
      }
      setModalOpen(false)
      fetchData()
    } catch { /* 统一处理 */ }
  }

  const resetFilters = () => {
    setFCode(undefined)
    setFName(undefined)
    setFMember(undefined)
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
      filteredValue: fName ? [fName] : null,
      filterDropdown: textFilterDropdown('筛选名称', (v) => setFName(v)),
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
      title: '操作', width: 100, align: 'left' as const,
      render: (_: any, record: any) => (
        <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>编辑</Button>
      ),
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
          </>
        }
        filterRight={
          <>
            <Button onClick={resetFilters}>重置筛选</Button>
            <Button icon={<ReloadOutlined />} onClick={() => fetchData()}>刷新</Button>
          </>
        }
      >
        <Table
          rowKey="id"
          size="middle"
          dataSource={pagedData}
          columns={columns}
          loading={loading}
          pagination={standardTablePagination({
            current: page,
            total: filteredData.length,
            pageSize,
            onChange: (p, ps) => { setPage(p); setPageSize(ps) },
          })}
        />
      </PageListShell>

      <Modal title={editingId ? '编辑公司' : '新增公司'} open={modalOpen}
        onOk={handleSubmit} onCancel={() => setModalOpen(false)} okText="保存">
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="公司名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          {!editingId && (
            <Form.Item name="code" label="公司编码（如 E、F）" rules={[{ required: true }]}>
              <Input maxLength={10} style={{ textTransform: 'uppercase' }} />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  )
}
