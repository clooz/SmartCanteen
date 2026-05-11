import { useState, useEffect } from 'react'
import { Table, Button, Modal, Form, Input, message, Typography, Space } from 'antd'
import { PlusOutlined, EditOutlined } from '@ant-design/icons'
import { adminApi } from '../../api/admin'

const { Title } = Typography

export default function CompaniesPage() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form] = Form.useForm()

  const fetchData = async () => {
    setLoading(true)
    try {
      const res: any = await adminApi.getCompanies()
      setData(res.data || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

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

  const columns = [
    { title: '公司编码', dataIndex: 'code', width: 100 },
    { title: '公司名称', dataIndex: 'name' },
    { title: '员工人数', dataIndex: 'member_count', width: 100 },
    {
      title: '操作', width: 80,
      render: (_: any, record: any) => (
        <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>编辑</Button>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>公司管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增公司</Button>
      </div>

      <Table rowKey="id" dataSource={data} columns={columns} loading={loading} pagination={false} />

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
