import { useState, useEffect } from 'react'
import {
  Table, Button, Tag, Space, Modal, Form, Input, Select,
  Switch, message, Typography, Popconfirm,
} from 'antd'
import { PlusOutlined, EditOutlined, KeyOutlined } from '@ant-design/icons'
import { adminApi } from '../../api/admin'
import dayjs from 'dayjs'

const { Title } = Typography
const { Option } = Select

const ROLE_MAP: Record<string, { label: string; color: string }> = {
  employee: { label: '员工', color: 'blue' },
  chef: { label: '厨师', color: 'orange' },
  admin: { label: '管理员', color: 'red' },
}

export default function UsersPage() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [companies, setCompanies] = useState<any[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [pwdModalOpen, setPwdModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form] = Form.useForm()
  const [pwdForm] = Form.useForm()
  const [filterRole, setFilterRole] = useState<string>()
  const [filterKeyword, setFilterKeyword] = useState<string>()

  const fetchData = async (p = 1) => {
    setLoading(true)
    try {
      const res: any = await adminApi.getUsers({ page: p, page_size: 15, role: filterRole, keyword: filterKeyword })
      setData(res.data.list)
      setTotal(res.data.total)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const fetchCompanies = async () => {
      const res: any = await adminApi.getCompanies()
      setCompanies(res.data || [])
    }
    fetchCompanies()
  }, [])

  useEffect(() => { fetchData(1); setPage(1) }, [filterRole, filterKeyword])

  const openCreate = () => {
    setEditingId(null)
    form.resetFields()
    setModalOpen(true)
  }

  const openEdit = (record: any) => {
    setEditingId(record.id)
    form.setFieldsValue({
      nickname: record.nickname, role: record.role,
      company_id: record.company_id, is_active: record.is_active === 1,
    })
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    const values = await form.validateFields()
    try {
      if (editingId === null) {
        await adminApi.createUser(values)
        message.success('用户创建成功')
      } else {
        await adminApi.updateUser(editingId, { ...values, is_active: values.is_active ? 1 : 0 })
        message.success('用户信息已更新')
      }
      setModalOpen(false)
      fetchData(page)
    } catch { /* 统一处理 */ }
  }

  const handleResetPwd = async () => {
    const values = await pwdForm.validateFields()
    try {
      await adminApi.resetPassword(editingId!, values)
      message.success('密码重置成功')
      setPwdModalOpen(false)
    } catch { /* 统一处理 */ }
  }

  const columns = [
    { title: '用户名', dataIndex: 'username' },
    { title: '昵称', dataIndex: 'nickname' },
    {
      title: '角色', dataIndex: 'role',
      render: (v: string) => <Tag color={ROLE_MAP[v]?.color}>{ROLE_MAP[v]?.label}</Tag>,
    },
    { title: '所属公司', dataIndex: 'company_name', render: (v: string) => v || '-' },
    {
      title: '状态', dataIndex: 'is_active',
      render: (v: number) => <Tag color={v ? 'green' : 'red'}>{v ? '启用' : '禁用'}</Tag>,
    },
    { title: '注册时间', dataIndex: 'created_at', render: (v: string) => dayjs(v).format('YYYY-MM-DD') },
    {
      title: '操作',
      render: (_: any, record: any) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>编辑</Button>
          <Button size="small" icon={<KeyOutlined />} onClick={() => { setEditingId(record.id); pwdForm.resetFields(); setPwdModalOpen(true) }}>
            重置密码
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>用户管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增用户</Button>
      </div>

      <Space style={{ marginBottom: 12 }}>
        <Select placeholder="角色筛选" allowClear style={{ width: 120 }} onChange={setFilterRole}>
          {Object.entries(ROLE_MAP).map(([k, v]) => <Option key={k} value={k}>{v.label}</Option>)}
        </Select>
        <Input.Search placeholder="搜索用户名/昵称" onSearch={setFilterKeyword} allowClear style={{ width: 200 }} />
      </Space>

      <Table rowKey="id" dataSource={data} columns={columns} loading={loading}
        pagination={{ current: page, total, pageSize: 15, onChange: (p) => { setPage(p); fetchData(p) } }}
      />

      <Modal title={editingId ? '编辑用户' : '新增用户'} open={modalOpen}
        onOk={handleSubmit} onCancel={() => setModalOpen(false)} okText="保存">
        <Form form={form} layout="vertical">
          {!editingId && (
            <>
              <Form.Item name="username" label="用户名" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="password" label="初始密码" rules={[{ required: true, min: 6 }]}>
                <Input.Password />
              </Form.Item>
            </>
          )}
          <Form.Item name="nickname" label="昵称">
            <Input />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true }]}>
            <Select>
              {Object.entries(ROLE_MAP).map(([k, v]) => <Option key={k} value={k}>{v.label}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="company_id" label="所属公司">
            <Select allowClear placeholder="厨师/管理员可不选">
              {companies.map((c: any) => <Option key={c.id} value={c.id}>{c.name}</Option>)}
            </Select>
          </Form.Item>
          {editingId && (
            <Form.Item name="is_active" label="账号状态" valuePropName="checked">
              <Switch checkedChildren="启用" unCheckedChildren="禁用" />
            </Form.Item>
          )}
        </Form>
      </Modal>

      <Modal title="重置密码" open={pwdModalOpen}
        onOk={handleResetPwd} onCancel={() => setPwdModalOpen(false)} okText="确认重置">
        <Form form={pwdForm} layout="vertical">
          <Form.Item name="new_password" label="新密码" rules={[{ required: true, min: 6, message: '密码不少于6位' }]}>
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
