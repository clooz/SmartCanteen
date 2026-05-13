import { useState, useEffect } from 'react'
import {
  Table, Button, Tag, Space, Modal, Form, Input, Select,
  Switch, message, Typography, Tooltip, Alert, App,
} from 'antd'
import {
  PlusOutlined, EditOutlined, KeyOutlined, ReloadOutlined, CloudSyncOutlined,
  CheckCircleOutlined, StopOutlined,
} from '@ant-design/icons'
import PageListShell, { standardTablePagination } from '../../components/PageListShell'
import { textFilterDropdown } from '../../utils/tableColumnFilters'
import { adminApi } from '../../api/admin'
import dayjs from 'dayjs'

const { Option } = Select
const { Text } = Typography

const ROLE_MAP: Record<string, { label: string; color: string }> = {
  employee: { label: '员工', color: 'blue' },
  chef: { label: '厨师', color: 'orange' },
  admin: { label: '管理员', color: 'red' },
}

const SYNC_SOURCE_MAP: Record<string, { label: string; color: string }> = {
  dingtalk: { label: '钉钉', color: 'blue' },
  wecom:    { label: '企业微信', color: 'green' },
  feishu:   { label: '飞书', color: 'cyan' },
  hr:       { label: 'HR系统', color: 'purple' },
}

/** 同步来源 badge，未知来源也能显示 */
const SyncSourceTag = ({ source }: { source?: string | null }) => {
  if (!source) return <Text type="secondary" style={{ fontSize: 12 }}>手动</Text>
  const m = SYNC_SOURCE_MAP[source]
  return <Tag color={m?.color ?? 'default'}>{m?.label ?? source}</Tag>
}

const SYNC_EXAMPLE = `{
  "source": "dingtalk",
  "users": [
    {
      "ext_uid": "ding_uid_001",
      "username": "13800000001",
      "nickname": "张三",
      "company_code": "A",
      "role": "employee",
      "is_active": 1
    }
  ]
}`

export default function UsersPage() {
  const { modal } = App.useApp()

  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [companies, setCompanies] = useState<any[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [pwdModalOpen, setPwdModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form] = Form.useForm()
  const [pwdForm] = Form.useForm()
  const [syncModalOpen, setSyncModalOpen] = useState(false)
  const [syncJson, setSyncJson] = useState(SYNC_EXAMPLE)
  const [syncLoading, setSyncLoading] = useState(false)
  const [filterRole, setFilterRole] = useState<string>()
  const [filterKeyword, setFilterKeyword] = useState<string>()
  const [colUsername, setColUsername] = useState<string | undefined>()
  const [colNickname, setColNickname] = useState<string | undefined>()
  const [colCompanyId, setColCompanyId] = useState<number | undefined>()
  const [colIsActive, setColIsActive] = useState<number | undefined>()
  const [listFilterKey, setListFilterKey] = useState(0)
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([])
  const [batchLoading, setBatchLoading] = useState(false)

  const fetchData = async (p = page, ps = pageSize) => {
    setLoading(true)
    setSelectedRowKeys([])
    try {
      const res: any = await adminApi.getUsers({
        page: p,
        page_size: ps,
        role: filterRole,
        keyword: filterKeyword,
        username: colUsername,
        nickname: colNickname,
        company_id: colCompanyId,
        ...(colIsActive === 0 || colIsActive === 1 ? { is_active: colIsActive } : {}),
      })
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

  useEffect(() => {
    fetchData(page, pageSize)
  }, [page, pageSize, filterRole, filterKeyword, colUsername, colNickname, colCompanyId, colIsActive])

  const resetListFilters = () => {
    setFilterRole(undefined)
    setFilterKeyword(undefined)
    setColUsername(undefined)
    setColNickname(undefined)
    setColCompanyId(undefined)
    setColIsActive(undefined)
    setListFilterKey(k => k + 1)
    setPage(1)
  }

  const handleBatchActive = (isActive: 0 | 1) => {
    const label = isActive ? '启用' : '禁用'
    modal.confirm({
      title: `确认批量${label}选中的 ${selectedRowKeys.length} 个用户？`,
      content: isActive ? '账号将恢复正常登录' : '账号将无法登录，已登录的会话不受影响',
      okText: `确认${label}`,
      okButtonProps: { danger: !isActive },
      cancelText: '取消',
      onOk: async () => {
        setBatchLoading(true)
        let ok = 0
        const errs: string[] = []
        try {
          await Promise.all(selectedRowKeys.map(id =>
            adminApi.updateUser(id, { is_active: isActive })
              .then(() => { ok++ })
              .catch((e: any) => {
                const name = data.find(r => r.id === id)?.nickname ?? String(id)
                errs.push(`${name}：${e?.response?.data?.message ?? '操作失败'}`)
              })
          ))
          if (ok) message.success(`已${label} ${ok} 个用户`)
          if (errs.length) message.warning(errs.join('；'))
          setSelectedRowKeys([])
          fetchData(page, pageSize)
        } finally { setBatchLoading(false) }
      },
    })
  }

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
      fetchData(page, pageSize)
    } catch { /* 统一处理 */ }
  }

  const handleSyncUsers = async () => {
    let payload: any
    try {
      payload = JSON.parse(syncJson)
    } catch {
      message.error('JSON 格式有误，请检查后重试')
      return
    }
    setSyncLoading(true)
    try {
      const res: any = await adminApi.syncUsers(payload)
      const { created, updated, skipped, errors } = res.data
      message.success(`同步完成：新增 ${created}，更新 ${updated}，跳过 ${skipped}`)
      if (errors?.length) {
        message.warning(`${errors.length} 条记录存在问题，请查看控制台`)
        console.warn('[syncUsers] errors:', errors)
      }
      setSyncModalOpen(false)
      fetchData(page, pageSize)
    } catch { /* 统一处理 */ }
    finally { setSyncLoading(false) }
  }

  const handleResetPwd = async () => {
    const values = await pwdForm.validateFields()
    try {
      await adminApi.resetPassword(editingId!, values)
      message.success('密码重置成功')
      setPwdModalOpen(false)
    } catch { /* 统一处理 */ }
  }

  const roleOptions = Object.entries(ROLE_MAP).map(([value, { label }]) => ({ label, value }))

  const columns = [
    {
      title: '用户名',
      dataIndex: 'username',
      filteredValue: colUsername ? [colUsername] : null,
      filterDropdown: textFilterDropdown('搜索用户名', (v) => { setColUsername(v); setPage(1) }),
    },
    {
      title: '昵称',
      dataIndex: 'nickname',
      filteredValue: colNickname ? [colNickname] : null,
      filterDropdown: textFilterDropdown('搜索昵称', (v) => { setColNickname(v); setPage(1) }),
    },
    {
      title: '角色',
      dataIndex: 'role',
      filteredValue: filterRole ? [filterRole] : null,
      filterDropdown: ({ confirm, clearFilters }: any) => (
        <div style={{ padding: 8 }}>
          <Select
            allowClear
            placeholder="角色"
            style={{ width: '100%', marginBottom: 8 }}
            value={filterRole}
            onChange={setFilterRole}
            options={roleOptions}
          />
          <Space>
            <Button type="primary" size="small" onClick={() => { setPage(1); confirm() }}>确定</Button>
            <Button size="small" onClick={() => { setFilterRole(undefined); clearFilters?.(); setPage(1); confirm() }}>重置</Button>
          </Space>
        </div>
      ),
      render: (v: string) => <Tag color={ROLE_MAP[v]?.color}>{ROLE_MAP[v]?.label}</Tag>,
    },
    {
      title: '所属公司',
      dataIndex: 'company_name',
      filteredValue: colCompanyId != null ? [String(colCompanyId)] : null,
      filterDropdown: ({ confirm, clearFilters }: any) => (
        <div style={{ padding: 8 }}>
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="选择公司"
            style={{ width: 220, marginBottom: 8 }}
            value={colCompanyId}
            onChange={(v) => setColCompanyId(v)}
            options={companies.map((c: any) => ({ label: c.name, value: c.id }))}
          />
          <Space>
            <Button type="primary" size="small" onClick={() => { setPage(1); confirm() }}>确定</Button>
            <Button size="small" onClick={() => { setColCompanyId(undefined); clearFilters?.(); setPage(1); confirm() }}>重置</Button>
          </Space>
        </div>
      ),
      render: (v: string) => v || '-',
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      filteredValue: colIsActive === 0 || colIsActive === 1 ? [String(colIsActive)] : null,
      filterDropdown: ({ confirm, clearFilters }: any) => (
        <div style={{ padding: 8 }}>
          <Select
            allowClear
            placeholder="账号状态"
            style={{ width: '100%', marginBottom: 8 }}
            value={colIsActive}
            onChange={(v) => setColIsActive(v)}
            options={[
              { label: '启用', value: 1 },
              { label: '禁用', value: 0 },
            ]}
          />
          <Space>
            <Button type="primary" size="small" onClick={() => { setPage(1); confirm() }}>确定</Button>
            <Button size="small" onClick={() => { setColIsActive(undefined); clearFilters?.(); setPage(1); confirm() }}>重置</Button>
          </Space>
        </div>
      ),
      render: (v: number) => <Tag color={v ? 'green' : 'red'}>{v ? '启用' : '禁用'}</Tag>,
    },
    {
      title: '来源',
      dataIndex: 'sync_source',
      align: 'center' as const,
      width: 96,
      render: (_: unknown, record: any) => (
        record.synced_at
          ? <Tooltip title={`最近同步：${dayjs(record.synced_at).format('YYYY-MM-DD HH:mm')}`}>
              <SyncSourceTag source={record.sync_source} />
            </Tooltip>
          : <SyncSourceTag source={null} />
      ),
    },
    {
      title: '注册时间',
      dataIndex: 'created_at',
      width: 110,
      sorter: (a: any, b: any) => dayjs(a.created_at).valueOf() - dayjs(b.created_at).valueOf(),
      render: (v: string) => dayjs(v).format('YYYY-MM-DD'),
    },
    {
      title: '操作', align: 'left' as const, width: 200,
      render: (_: any, record: any) => (
        <Space size={4}>
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
      <PageListShell
        title="用户管理"
        headerExtra={
          <Space>
            {selectedRowKeys.length > 0 && (
              <>
                <Text type="secondary">
                  已选 <Text strong style={{ color: '#1677ff' }}>{selectedRowKeys.length}</Text> 项
                </Text>
                <Button icon={<CheckCircleOutlined />} loading={batchLoading}
                  onClick={() => handleBatchActive(1)}>批量启用</Button>
                <Button danger icon={<StopOutlined />} loading={batchLoading}
                  onClick={() => handleBatchActive(0)}>批量禁用</Button>
              </>
            )}
            <Button icon={<CloudSyncOutlined />} onClick={() => { setSyncJson(SYNC_EXAMPLE); setSyncModalOpen(true) }}>
              导入 / 同步
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增用户</Button>
          </Space>
        }
        filterLeft={
          <>
            <Text type="secondary" style={{ fontSize: 13 }}>角色</Text>
            <Select placeholder="全部" allowClear style={{ width: 120 }}
              value={filterRole}
              onChange={(v) => { setFilterRole(v); setPage(1) }}>
              {Object.entries(ROLE_MAP).map(([k, v]) => <Option key={k} value={k}>{v.label}</Option>)}
            </Select>
            <Text type="secondary" style={{ fontSize: 13 }}>用户名</Text>
            <Input.Search key={`u-lk-${listFilterKey}-name`} placeholder="模糊" allowClear style={{ width: 140 }}
              onSearch={(v) => { setColUsername(v || undefined); setPage(1) }} />
            <Text type="secondary" style={{ fontSize: 13 }}>昵称</Text>
            <Input.Search key={`u-lk-${listFilterKey}-nick`} placeholder="模糊" allowClear style={{ width: 140 }}
              onSearch={(v) => { setColNickname(v || undefined); setPage(1) }} />
            <Text type="secondary" style={{ fontSize: 13 }}>公司</Text>
            <Select showSearch optionFilterProp="label" placeholder="全部" allowClear style={{ width: 160 }}
              value={colCompanyId}
              onChange={(v) => { setColCompanyId(v); setPage(1) }}>
              {companies.map((c: any) => <Option key={c.id} value={c.id}>{c.name}</Option>)}
            </Select>
            <Text type="secondary" style={{ fontSize: 13 }}>状态</Text>
            <Select placeholder="全部" allowClear style={{ width: 110 }}
              value={colIsActive}
              onChange={(v) => { setColIsActive(v); setPage(1) }}>
              <Option value={1}>启用</Option>
              <Option value={0}>禁用</Option>
            </Select>
            <Text type="secondary" style={{ fontSize: 13 }}>关键词</Text>
            <Input.Search key={`u-lk-${listFilterKey}-kw`} placeholder="用户名或昵称" allowClear style={{ width: 180 }}
              onSearch={(v) => { setFilterKeyword(v || undefined); setPage(1) }} />
          </>
        }
        filterRight={
          <>
            <Button onClick={resetListFilters}>重置筛选</Button>
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
          scroll={{ x: 900 }}
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

      <Modal title={editingId ? '编辑用户' : '新增用户'} open={modalOpen} destroyOnClose
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

      {/* 外部工作平台批量导入 / 同步弹窗 */}
      <Modal
        title="导入 / 同步工作平台人员"
        open={syncModalOpen}
        destroyOnClose
        width={640}
        okText="立即同步"
        confirmLoading={syncLoading}
        onOk={handleSyncUsers}
        onCancel={() => setSyncModalOpen(false)}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Alert
            type="info"
            showIcon
            message="对接说明"
            description={
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13 }}>
                <li>将工作平台（钉钉、企微、飞书、自研HR）的人员信息按下方格式粘贴，点击「立即同步」。</li>
                <li><b>ext_uid</b> 为外部平台的用户唯一ID，是日后自动对接的主键，强烈建议填写。</li>
                <li>已存在的用户将被<b>更新</b>（不会修改密码），新用户默认密码 <b>123456</b>，首次登录请修改。</li>
                <li>平台自动化对接时，直接向接口 <code>POST /api/admin/users/sync</code> 发送相同格式的 JSON 即可，无需手动操作此弹窗。</li>
              </ul>
            }
          />
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
              JSON 数据（可直接粘贴或修改）
            </Text>
            <Input.TextArea
              value={syncJson}
              onChange={(e) => setSyncJson(e.target.value)}
              rows={14}
              style={{ fontFamily: 'monospace', fontSize: 12 }}
              spellCheck={false}
            />
          </div>
        </Space>
      </Modal>

      <Modal title="重置密码" open={pwdModalOpen} destroyOnClose
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
