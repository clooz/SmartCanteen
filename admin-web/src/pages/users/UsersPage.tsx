import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Table, Button, Tag, Space, Modal, Form, Input, Select,
  Switch, message, Typography, Tooltip, Alert, App, Avatar, Progress,
} from 'antd'
import {
  PlusOutlined, EditOutlined, KeyOutlined, ReloadOutlined, CloudSyncOutlined,
  CheckCircleOutlined, StopOutlined,
} from '@ant-design/icons'
import PageListShell, { standardTablePagination } from '../../components/PageListShell'
import { textFilterDropdown } from '../../utils/tableColumnFilters'
import { tableListLocale, TableLoadErrorAlert } from '../../utils/tableListLocale'
import { filterBarRowStyle, filterBarCellStyle, filterBarLabelStyle } from '../../utils/filterToolbarLayout'
import { adminApi } from '../../api/admin'
import { authStore, userHasPermission } from '../../store/authStore'
import {
  generateStrongPassword,
  isPasswordStrongEnough,
  passwordStrengthMeta,
  passwordStrengthScore,
} from '../../utils/passwordStrength'
import dayjs from 'dayjs'

const { Option } = Select
const { Text } = Typography

const ROLE_MAP: Record<string, { label: string; color: string }> = {
  employee: { label: '用户', color: 'blue' },
  chef: { label: '厨师', color: 'orange' },
  admin: { label: '管理员', color: 'red' },
}

/** 预置后台岗位 code → Tag 色（与权限管理同源；自定义岗位按 code 稳定映射调色板） */
const ADMIN_ROLE_CODE_COLORS: Record<string, string> = {
  super_admin: 'red',
  system_admin: 'geekblue',
  chef_default: 'orange',
}

const CUSTOM_ADMIN_ROLE_COLORS = ['purple', 'cyan', 'magenta', 'volcano', 'lime', 'gold'] as const

function adminRoleTagColor(code: string | undefined | null): string {
  if (!code) return 'purple'
  const preset = ADMIN_ROLE_CODE_COLORS[code]
  if (preset) return preset
  let h = 0
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) >>> 0
  return CUSTOM_ADMIN_ROLE_COLORS[h % CUSTOM_ADMIN_ROLE_COLORS.length]
}

/** 表单「角色」单选值 → 接口 users.role + admin_role_id（与权限管理 admin_roles 对齐） */
function rolePickToPayload(
  pick: string,
  adminRoleRows: { id: number; code: string; name: string }[],
): { role: string; admin_role_id?: number | null } {
  if (pick === 'employee') return { role: 'employee', admin_role_id: null }
  if (!pick.startsWith('ar:')) return { role: 'employee', admin_role_id: null }
  const id = parseInt(pick.slice(3), 10)
  if (!Number.isFinite(id)) return { role: 'employee', admin_role_id: null }
  const ar = adminRoleRows.find((r) => r.id === id)
  if (!ar) return { role: 'employee', admin_role_id: null }
  const role = ar.code === 'chef_default' ? 'chef' : 'admin'
  return { role, admin_role_id: id }
}

/** 与「权限管理」一致：已绑定后台岗位时只显示 admin_roles.name；否则显示 users.role 大类（纯点餐用户等） */
function RoleColumnTags({ record }: { record: any }) {
  if (record.admin_role_id && record.admin_role_name) {
    const color = adminRoleTagColor(record.admin_role_code)
    return <Tag color={color}>{record.admin_role_name}</Tag>
  }
  const ur = ROLE_MAP[record.role]
  return <Tag color={ur?.color}>{ur?.label ?? record.role}</Tag>
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
      "username": "zhangsan@company.com",
      "phone": "13800000001",
      "nickname": "张三",
      "company_code": "A",
      "role": "employee",
      "is_active": 1
    }
  ]
}`

export default function UsersPage() {
  const { modal } = App.useApp()
  const [searchParams, setSearchParams] = useSearchParams()

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
  const watchCreatePassword = Form.useWatch('create_password', form)
  const [syncModalOpen, setSyncModalOpen] = useState(false)
  const [syncJson, setSyncJson] = useState(SYNC_EXAMPLE)
  const [syncLoading, setSyncLoading] = useState(false)
  const [filterRole, setFilterRole] = useState<string>()
  const [filterKeyword, setFilterKeyword] = useState<string>()
  const [colUsername, setColUsername] = useState<string | undefined>()
  const [colNickname, setColNickname] = useState<string | undefined>()
  const [colCompanyId, setColCompanyId] = useState<number | undefined>()
  const [colIsActive, setColIsActive] = useState<number | undefined>()
  const [colAdminRoleId, setColAdminRoleId] = useState<number | undefined>(() => {
    const raw = searchParams.get('admin_role_id')
    return raw != null && /^\d+$/.test(raw) ? parseInt(raw, 10) : undefined
  })
  const [adminRoleOptions, setAdminRoleOptions] = useState<{ id: number; code: string; name: string }[]>([])
  const [listFilterKey, setListFilterKey] = useState(0)
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([])
  const [batchLoading, setBatchLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [userModalSubmitting, setUserModalSubmitting] = useState(false)
  const [pwdModalSubmitting, setPwdModalSubmitting] = useState(false)

  const companyOptionLabel = (c: any) =>
    `${c.name ?? ''}${Number(c.is_active) === 0 ? '（已停用）' : ''}`

  /** 具备 rbac:assign 时：角色下拉里为「用户 + 权限管理全部后台角色」 */
  const modalRolePickList = useMemo(() => {
    const u = authStore.getUser()
    if (!u || !userHasPermission(u, 'rbac:assign')) return null
    return [
      { value: 'employee', label: '用户（仅小程序点餐，无管理后台）' },
      ...adminRoleOptions.map((r) => ({
        value: `ar:${r.id}`,
        label: `${r.name}（${r.code}）`,
      })),
    ]
  }, [adminRoleOptions, modalOpen])

  const fetchData = async (p = page, ps = pageSize) => {
    setLoading(true)
    setSelectedRowKeys([])
    setLoadError(false)
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
        ...(colAdminRoleId != null ? { admin_role_id: colAdminRoleId } : {}),
      })
      setData(res.data.list)
      setTotal(res.data.total)
    } catch {
      setLoadError(true)
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
    const raw = searchParams.get('admin_role_id')
    setColAdminRoleId(raw != null && /^\d+$/.test(raw) ? parseInt(raw, 10) : undefined)
  }, [searchParams])

  useEffect(() => {
    const u = authStore.getUser()
    if (!u) return
    let cancelled = false
    const apply = (rows: { id: number; code: string; name: string }[]) => {
      if (!cancelled) setAdminRoleOptions(rows)
    }
    /** 超管走 RBAC 岗位列表（与权限管理同源），避免依赖 /lookup/admin-roles 未部署时整页报「网络错误」 */
    if (u.is_super_admin) {
      adminApi.rbacListRoles()
        .then((res: any) => {
          const list = (res.data || []).map((r: any) => ({
            id: r.id,
            code: r.code,
            name: r.name,
          }))
          apply(list)
        })
        .catch(() => apply([]))
    } else {
      adminApi.listAdminRolesBrief()
        .then((res: any) => apply(res.data || []))
        .catch(() => apply([]))
    }
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    fetchData(page, pageSize)
  }, [page, pageSize, filterRole, filterKeyword, colUsername, colNickname, colCompanyId, colIsActive, colAdminRoleId])

  const setAdminRoleFilter = (v: number | undefined | null) => {
    const nextId = v == null ? undefined : v
    setColAdminRoleId(nextId)
    setPage(1)
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev)
      if (nextId == null) n.delete('admin_role_id')
      else n.set('admin_role_id', String(nextId))
      return n
    }, { replace: true })
  }

  const resetListFilters = () => {
    setFilterRole(undefined)
    setFilterKeyword(undefined)
    setColUsername(undefined)
    setColNickname(undefined)
    setColCompanyId(undefined)
    setColIsActive(undefined)
    setColAdminRoleId(undefined)
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev)
      n.delete('admin_role_id')
      return n
    }, { replace: true })
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
    const u = authStore.getUser()
    const defaults: Record<string, unknown> = {
      create_username: '',
      create_password: '',
      phone: '',
      nickname: '',
    }
    if (userHasPermission(u, 'rbac:assign')) {
      defaults.rolePick = 'employee'
    } else {
      defaults.role = 'employee'
    }
    form.setFieldsValue(defaults)
    setModalOpen(true)
  }

  const openEdit = (record: any) => {
    setEditingId(record.id)
    form.resetFields()
    const u = authStore.getUser()
    const can = userHasPermission(u, 'rbac:assign')
    const base = {
      nickname: record.nickname,
      company_id: record.company_id,
      is_active: record.is_active === 1,
      phone: record.phone || '',
    }
    if (can) {
      let rolePick = 'employee'
      if (record.admin_role_id) {
        rolePick = `ar:${record.admin_role_id}`
      } else if (record.role === 'chef') {
        const cd = adminRoleOptions.find((x) => x.code === 'chef_default')
        if (cd) rolePick = `ar:${cd.id}`
      } else if (record.role === 'admin') {
        const sd = adminRoleOptions.find((x) => x.code === 'super_admin')
          ?? adminRoleOptions.find((x) => x.code === 'system_admin')
        if (sd) rolePick = `ar:${sd.id}`
      }
      form.setFieldsValue({ ...base, rolePick })
    } else {
      form.setFieldsValue({ ...base, role: record.role })
    }
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    const values = await form.validateFields()
    const me = authStore.getUser()
    const canAssign = userHasPermission(me, 'rbac:assign')
    setUserModalSubmitting(true)
    try {
      if (editingId === null) {
        const payload: Record<string, unknown> = { ...values }
        payload.username = values.create_username
        payload.password = values.create_password
        delete payload.create_username
        delete payload.create_password
        delete payload.rolePick
        delete payload.admin_role_id
        if (!payload.phone || !String(payload.phone).trim()) delete payload.phone
        else payload.phone = String(payload.phone).trim()
        if (canAssign) {
          const pick = String(values.rolePick ?? 'employee')
          const decoded = rolePickToPayload(pick, adminRoleOptions)
          payload.role = decoded.role
          if (decoded.admin_role_id != null) payload.admin_role_id = decoded.admin_role_id
        }
        await adminApi.createUser(payload)
        message.success('用户创建成功')
      } else {
        const payload: Record<string, unknown> = {
          nickname: values.nickname,
          company_id: values.company_id,
          is_active: values.is_active ? 1 : 0,
          phone: values.phone === undefined || values.phone === null
            ? ''
            : String(values.phone).trim(),
        }
        if (canAssign) {
          const pick = String(values.rolePick ?? 'employee')
          const decoded = rolePickToPayload(pick, adminRoleOptions)
          payload.role = decoded.role
          if (decoded.admin_role_id != null) payload.admin_role_id = decoded.admin_role_id
        } else {
          payload.role = values.role
        }
        await adminApi.updateUser(editingId, payload)
        message.success('用户信息已更新')
      }
      setModalOpen(false)
      fetchData(page, pageSize)
    } catch { /* 统一处理 */ }
    finally {
      setUserModalSubmitting(false)
    }
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
    setPwdModalSubmitting(true)
    try {
      await adminApi.resetPassword(editingId!, values)
      message.success('密码重置成功')
      setPwdModalOpen(false)
    } catch { /* 统一处理 */ }
    finally {
      setPwdModalSubmitting(false)
    }
  }

  const roleOptions = Object.entries(ROLE_MAP).map(([value, { label }]) => ({ label, value }))

  const columns = [
    {
      title: '头像',
      dataIndex: 'avatar',
      width: 72,
      align: 'center' as const,
      render: (_: string | null, record: any) => {
        const url = (record.avatar && String(record.avatar).trim()) || ''
        const nick = String(record.nickname || record.username || '?').trim() || '?'
        const src = url || undefined
        return (
          <Tooltip title={url || '未设置头像'}>
            <Avatar size={40} src={src}>
              {!url ? nick.slice(0, 1) : undefined}
            </Avatar>
          </Tooltip>
        )
      },
    },
    {
      title: '登录名',
      dataIndex: 'username',
      filteredValue: colUsername ? [colUsername] : null,
      filterDropdown: textFilterDropdown('搜索邮箱/登录名', (v) => { setColUsername(v); setPage(1) }),
      ellipsis: true,
    },
    {
      title: '手机',
      dataIndex: 'phone',
      width: 120,
      render: (v: string | null) => v || '-',
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
      render: (_: string, record: any) => <RoleColumnTags record={record} />,
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
            options={companies.map((c: any) => ({ label: companyOptionLabel(c), value: c.id }))}
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
        filterBar={
          <div style={filterBarRowStyle}>
            <div style={filterBarCellStyle(120)}>
              <Text type="secondary" style={filterBarLabelStyle}>角色</Text>
              <Select
                placeholder="全部"
                allowClear
                style={{ flex: 1, minWidth: 88, maxWidth: '100%' }}
                value={filterRole}
                onChange={(v) => { setFilterRole(v); setPage(1) }}
              >
                {Object.entries(ROLE_MAP).map(([k, v]) => <Option key={k} value={k}>{v.label}</Option>)}
              </Select>
            </div>
            <div style={filterBarCellStyle(200)}>
              <Text type="secondary" style={filterBarLabelStyle}>后台岗位</Text>
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="全部"
                allowClear
                style={{ flex: 1, minWidth: 120, maxWidth: '100%' }}
                value={colAdminRoleId}
                onChange={(v) => setAdminRoleFilter(v)}
                options={adminRoleOptions.map((r) => ({
                  label: `${r.name}（${r.code}）`,
                  value: r.id,
                }))}
              />
            </div>
            <div style={filterBarCellStyle(150)}>
              <Text type="secondary" style={filterBarLabelStyle}>登录名</Text>
              <Input.Search
                key={`u-lk-${listFilterKey}-name`}
                placeholder="邮箱模糊"
                allowClear
                style={{ flex: 1, minWidth: 0, maxWidth: '100%' }}
                onSearch={(v) => { setColUsername(v || undefined); setPage(1) }}
              />
            </div>
            <div style={filterBarCellStyle(150)}>
              <Text type="secondary" style={filterBarLabelStyle}>公司</Text>
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="全部"
                allowClear
                style={{ flex: 1, minWidth: 88, maxWidth: '100%' }}
                value={colCompanyId}
                onChange={(v) => { setColCompanyId(v); setPage(1) }}
              >
                {companies.map((c: any) => <Option key={c.id} value={c.id}>{companyOptionLabel(c)}</Option>)}
              </Select>
            </div>
            <div style={filterBarCellStyle(120)}>
              <Text type="secondary" style={filterBarLabelStyle}>状态</Text>
              <Select
                placeholder="全部"
                allowClear
                style={{ flex: 1, minWidth: 72, maxWidth: '100%' }}
                value={colIsActive}
                onChange={(v) => { setColIsActive(v); setPage(1) }}
              >
                <Option value={1}>启用</Option>
                <Option value={0}>禁用</Option>
              </Select>
            </div>
            <div style={filterBarCellStyle(180)}>
              <Text type="secondary" style={filterBarLabelStyle}>关键词</Text>
              <Input.Search
                key={`u-lk-${listFilterKey}-kw`}
                placeholder="邮箱 / 昵称 / 手机"
                allowClear
                style={{ flex: 1, minWidth: 0, maxWidth: '100%' }}
                onSearch={(v) => { setFilterKeyword(v || undefined); setPage(1) }}
              />
            </div>
            <div style={filterBarCellStyle(180, 'flex-end')}>
              <Button onClick={resetListFilters}>重置筛选</Button>
              <Button icon={<ReloadOutlined />} onClick={() => fetchData(page, pageSize)}>刷新</Button>
            </div>
          </div>
        }
      >
        <TableLoadErrorAlert error={loadError} onRetry={() => fetchData(page, pageSize)} />
        <Table
          rowKey="id"
          size="middle"
          dataSource={data}
          columns={columns}
          loading={loading}
          locale={tableListLocale}
          scroll={{ x: 1020 }}
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
        onOk={handleSubmit} onCancel={() => setModalOpen(false)} okText="保存" confirmLoading={userModalSubmitting}>
        <Form form={form} layout="vertical" autoComplete="off">
          {!editingId && (
            <>
              <Form.Item
                name="create_username"
                label="邮箱（登录名）"
                rules={[
                  { required: true, message: '请输入登录名' },
                  { min: 3, max: 191 },
                ]}
                extra="一般为邮箱，也可为管理员分配的其它登录名"
              >
                <Input
                  placeholder="邮箱或登录名"
                  autoComplete="off"
                  name="sc-create-username"
                  id="sc-create-username"
                />
              </Form.Item>
              <Form.Item
                name="create_password"
                label="初始密码"
                rules={[
                  { required: true, message: '请输入初始密码' },
                  { min: 8, message: '密码至少 8 位' },
                  {
                    validator: (_, v) => {
                      if (v == null || String(v).length === 0) return Promise.resolve()
                      if (!isPasswordStrongEnough(String(v))) {
                        return Promise.reject(
                          new Error(
                            '密码至少 8 位，且需包含大写字母、小写字母、数字、特殊符号中的至少三种',
                          ),
                        )
                      }
                      return Promise.resolve()
                    },
                  },
                ]}
                extra={
                  typeof watchCreatePassword === 'string' && watchCreatePassword.length > 0 ? (
                    <div style={{ marginTop: 6 }}>
                      {(() => {
                        const score = passwordStrengthScore(watchCreatePassword)
                        const meta = passwordStrengthMeta(score)
                        const progStatus = score <= 1 ? 'exception' : score === 2 ? 'active' : 'success'
                        return (
                          <>
                            <Progress percent={meta.percent} size="small" status={progStatus} showInfo={false} />
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              密码强度：<Text strong>{meta.label || '—'}</Text>
                              {!isPasswordStrongEnough(watchCreatePassword) && score >= 2 ? (
                                <Text type="secondary">（保存还需满足至少三种字符类型）</Text>
                              ) : null}
                            </Text>
                          </>
                        )
                      })()}
                    </div>
                  ) : (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      至少 8 位；大写、小写、数字、特殊符号至少包含三种。可使用「随机生成」一键填入高强度密码。
                    </Text>
                  )
                }
              >
                <Input.Password
                  placeholder="请输入或通过右侧生成"
                  autoComplete="new-password"
                  name="sc-create-password"
                  id="sc-create-password"
                  addonAfter={(
                    <Button
                      type="link"
                      size="small"
                      style={{ padding: '0 4px', height: 22, lineHeight: '22px' }}
                      onClick={() => {
                        const prev = form.getFieldValue('create_password') as string | undefined
                        const next = generateStrongPassword({ length: 16, avoid: prev ?? '' })
                        form.setFieldsValue({ create_password: next })
                        void form.validateFields(['create_password'])
                        message.success('已填入随机密码')
                      }}
                    >
                      随机生成
                    </Button>
                  )}
                />
              </Form.Item>
              <Form.Item name="phone" label="手机号（可选）" rules={[{ pattern: /^$|^1\d{10}$/, message: '须为 11 位手机号' }]}>
                <Input placeholder="用于短信验证码登录" maxLength={11} />
              </Form.Item>
            </>
          )}
          <Form.Item name="nickname" label="昵称">
            <Input />
          </Form.Item>
          {modalRolePickList ? (
            <Form.Item
              name="rolePick"
              label="角色"
              rules={[{ required: true, message: '请选择角色' }]}
              extra="与「权限管理」中的后台角色一致；选「用户」表示仅点餐端、不登录管理后台。"
            >
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="请选择角色"
                options={modalRolePickList}
              />
            </Form.Item>
          ) : (
            <Form.Item name="role" label="角色" rules={[{ required: true, message: '请选择角色' }]}>
              <Select placeholder="请选择">
                {Object.entries(ROLE_MAP).map(([k, v]) => (
                  <Option key={k} value={k}>{v.label}</Option>
                ))}
              </Select>
            </Form.Item>
          )}
          <Form.Item
            name="company_id"
            label="所属公司"
            extra="建议各类账号均填写所属公司，便于多公司共用平台时的管理；当前为选填，留空表示暂不归属任一公司。"
          >
            <Select allowClear placeholder="请选择所属公司" showSearch optionFilterProp="label">
              {companies.map((c: any) => <Option key={c.id} value={c.id}>{companyOptionLabel(c)}</Option>)}
            </Select>
          </Form.Item>
          {editingId && (
            <Form.Item name="phone" label="手机号" rules={[{ pattern: /^$|^1\d{10}$/, message: '须为 11 位手机号或留空' }]}>
              <Input placeholder="留空表示不修改" allowClear maxLength={11} />
            </Form.Item>
          )}
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
                <li><b>username</b> 登录名，常用邮箱；可选 <b>phone</b>（11 位）用于短信登录。</li>
                <li>已存在的用户将被<b>更新</b>（不会修改密码），新用户默认密码 <b>123456</b>，首次登录请修改。</li>
                <li><b>role</b> 仅能为 <code>employee</code> / <code>chef</code> / <code>admin</code>（员工类型），与「权限管理」里可配置的后台岗位不是同一字段；同步不会指定自定义后台岗位，系统会对 <code>chef</code>/<code>admin</code> 自动关联默认后台岗位（与手动新建一致）。</li>
                <li>本页「新建用户」的初始密码强度规则<b>仅适用于手动添加</b>；通过同步创建的用户仍使用默认密码 <b>123456</b>。</li>
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
        onOk={handleResetPwd} onCancel={() => setPwdModalOpen(false)} okText="确认重置" confirmLoading={pwdModalSubmitting}>
        <Form form={pwdForm} layout="vertical">
          <Form.Item name="new_password" label="新密码" rules={[{ required: true, min: 6, message: '密码不少于6位' }]}>
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
