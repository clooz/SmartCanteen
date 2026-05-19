import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  App,
  Button,
  Card,
  Checkbox,
  Drawer,
  Empty,
  Form,
  Input,
  Modal,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { adminApi } from '../../api/admin'
import PageListShell from '../../components/PageListShell'
import { formatAuditAction, formatAuditDetail } from '../../utils/auditLogDisplay'
import { tableListLocale } from '../../utils/tableListLocale'

type RoleRow = {
  id: number
  code: string
  name: string
  description: string
  is_system: number
  user_count: number
}

type PermItem = { key: string; module: string; label: string; description?: string }

type MemberRow = {
  id: number
  username: string
  nickname: string
  role: string
  admin_role_name?: string | null
  company_name?: string | null
}

type AuditLogRow = {
  id: number
  actor_username?: string | null
  action: string
  detail_json?: string | null
  created_at: string
}

export default function RbacRolesPage() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const [roles, setRoles] = useState<RoleRow[]>([])
  const [catalog, setCatalog] = useState<PermItem[]>([])
  const [loading, setLoading] = useState(false)
  const [permModal, setPermModal] = useState<{ open: boolean; role: RoleRow | null }>({ open: false, role: null })
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [permLoading, setPermLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm] = Form.useForm()
  const [audit, setAudit] = useState<{ total: number; list: object[] }>({ total: 0, list: [] })
  const [auditPage, setAuditPage] = useState(1)
  const [membersDrawer, setMembersDrawer] = useState<{ open: boolean; role: RoleRow | null }>({
    open: false,
    role: null,
  })
  const [membersLoading, setMembersLoading] = useState(false)
  const [membersList, setMembersList] = useState<MemberRow[]>([])
  const [membersTotal, setMembersTotal] = useState(0)
  const [rolesListPage, setRolesListPage] = useState(1)
  const [rolesListPageSize, setRolesListPageSize] = useState(10)

  const loadRoles = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await adminApi.rbacListRoles()
      setRoles(res.data || [])
    } finally {
      setLoading(false)
    }
  }, [])

  const loadCatalog = useCallback(async () => {
    const res: any = await adminApi.rbacPermissionsCatalog()
    setCatalog(res.data?.list || [])
  }, [])

  useEffect(() => {
    void loadRoles()
    void loadCatalog()
  }, [loadRoles, loadCatalog])

  const loadAudit = useCallback(async (page: number) => {
    const res: any = await adminApi.rbacAuditLogs({ page, page_size: 15 })
    setAudit({ total: res.data?.total ?? 0, list: res.data?.list ?? [] })
  }, [])

  useEffect(() => {
    void loadAudit(auditPage)
  }, [auditPage, loadAudit])

  const rolesPaged = useMemo(() => {
    const start = (rolesListPage - 1) * rolesListPageSize
    return roles.slice(start, start + rolesListPageSize)
  }, [roles, rolesListPage, rolesListPageSize])

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(roles.length / rolesListPageSize) || 1)
    if (rolesListPage > totalPages) setRolesListPage(totalPages)
  }, [roles.length, rolesListPage, rolesListPageSize])

  const groupedCatalog = useMemo(() => {
    const m = new Map<string, PermItem[]>()
    for (const p of catalog) {
      if (!m.has(p.module)) m.set(p.module, [])
      m.get(p.module)!.push(p)
    }
    return Array.from(m.entries())
  }, [catalog])

  const permLabelByKey = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of catalog) m.set(p.key, p.label)
    return m
  }, [catalog])

  const auditColumns: ColumnsType<AuditLogRow> = useMemo(
    () => [
      {
        title: '时间',
        dataIndex: 'created_at',
        width: '16%',
        align: 'left',
        render: (v: string) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '—'),
      },
      {
        title: '操作人',
        dataIndex: 'actor_username',
        width: '20%',
        align: 'left',
        ellipsis: true,
        render: (v: string | null | undefined) => v?.trim() || '—',
      },
      {
        title: '操作',
        dataIndex: 'action',
        width: '14%',
        align: 'center',
        render: (action: string) => formatAuditAction(action),
      },
      {
        title: '说明',
        key: 'detail',
        align: 'left',
        ellipsis: { showTitle: false },
        render: (_, row) => {
          const text = formatAuditDetail(row.action, row.detail_json, permLabelByKey)
          return (
            <Tooltip title={text} placement="topLeft">
              <Typography.Text ellipsis style={{ display: 'block', width: '100%' }}>
                {text}
              </Typography.Text>
            </Tooltip>
          )
        },
      },
    ],
    [permLabelByKey],
  )

  const openPerm = async (role: RoleRow) => {
    if (role.code === 'super_admin') {
      message.warning('超级管理员权限为系统固定，无需编辑')
      return
    }
    setPermModal({ open: true, role })
    setPermLoading(true)
    try {
      const res: any = await adminApi.rbacGetRolePermissions(role.id)
      setSelectedKeys(res.data?.keys || [])
    } finally {
      setPermLoading(false)
    }
  }

  const savePerm = async () => {
    if (!permModal.role) return
    setPermLoading(true)
    try {
      await adminApi.rbacSetRolePermissions(permModal.role.id, selectedKeys)
      message.success('已保存')
      setPermModal({ open: false, role: null })
      void loadRoles()
    } finally {
      setPermLoading(false)
    }
  }

  const handleDelete = async (r: RoleRow) => {
    Modal.confirm({
      title: `删除岗位「${r.name}」？`,
      okType: 'danger',
      onOk: async () => {
        await adminApi.rbacDeleteRole(r.id)
        message.success('已删除')
        void loadRoles()
      },
    })
  }

  const openMembers = useCallback(async (r: RoleRow) => {
    setMembersDrawer({ open: true, role: r })
    setMembersLoading(true)
    setMembersList([])
    setMembersTotal(0)
    const applyRows = (list: unknown, total: unknown) => {
      setMembersList(Array.isArray(list) ? (list as MemberRow[]) : [])
      setMembersTotal(typeof total === 'number' ? total : Number(total) || 0)
    }
    try {
      const res: any = await adminApi.rbacRoleMembers(r.id, { page: 1, page_size: 50 }, { skipErrorToast: true })
      applyRows(res.data?.list, res.data?.total)
    } catch {
      // 旧后端无 /rbac/roles/:id/members，或多实例占用 3000 导致新代码未生效时，回退到用户列表筛选
      try {
        const res2: any = await adminApi.getUsers(
          { admin_role_id: r.id, page: 1, page_size: 50 },
          { skipErrorToast: true },
        )
        applyRows(res2.data?.list, res2.data?.total)
      } catch {
        message.error(
          '加载成员列表失败。若刚更新代码，请结束占用 3000 端口的旧 Node 进程后只启动一个后端，再刷新页面重试。',
        )
      }
    } finally {
      setMembersLoading(false)
    }
  }, [message])

  const columns: ColumnsType<RoleRow> = [
    { title: '编码', dataIndex: 'code', width: 160 },
    { title: '角色名称', dataIndex: 'name' },
    { title: '说明', dataIndex: 'description', ellipsis: true },
    {
      title: '类型',
      width: 100,
      render: (_, r) => (r.is_system ? <Tag color="blue">系统</Tag> : <Tag>自定义</Tag>),
    },
    {
      title: '绑定用户数',
      dataIndex: 'user_count',
      width: 120,
      render: (n: number, r) => (
        <Button type="link" size="small" style={{ padding: 0, height: 'auto' }} onClick={() => void openMembers(r)}>
          {n}
        </Button>
      ),
    },
    {
      title: '操作',
      width: 200,
      render: (_, r) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => void openPerm(r)}>
            权限
          </Button>
          {!r.is_system && (
            <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => void handleDelete(r)}>
              删除
            </Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <>
      <PageListShell title="权限管理" variant="plain">
        <Tabs
        items={[
          {
            key: 'roles',
            label: '角色与权限',
            children: (
              <Card
                title="后台角色"
                styles={{
                  header: {
                    paddingTop: 12,
                    paddingBottom: 12,
                    minHeight: 'auto',
                  },
                  body: {
                    paddingTop: 20,
                    paddingBottom: 24,
                  },
                }}
                extra={(
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
                    新建角色
                  </Button>
                )}
              >
                <Table
                  rowKey="id"
                  loading={loading}
                  columns={columns}
                  dataSource={rolesPaged}
                  pagination={{
                    current: rolesListPage,
                    pageSize: rolesListPageSize,
                    total: roles.length,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    pageSizeOptions: [10, 20, 50],
                    showTotal: (total) => `共 ${total} 条`,
                    onChange: (page, size) => {
                      setRolesListPage(page)
                      if (size) setRolesListPageSize(size)
                    },
                  }}
                />
              </Card>
            ),
          },
          {
            key: 'audit',
            label: '操作日志',
            children: (
              <Card
                styles={{
                  body: {
                    paddingTop: 20,
                    paddingBottom: 24,
                  },
                }}
              >
                <Table<AuditLogRow>
                  rowKey="id"
                  size="middle"
                  tableLayout="fixed"
                  style={{ width: '100%' }}
                  dataSource={audit.list as AuditLogRow[]}
                  columns={auditColumns}
                  locale={tableListLocale}
                  pagination={{
                    current: auditPage,
                    pageSize: 15,
                    total: audit.total,
                    showTotal: (t) => `共 ${t} 条`,
                    onChange: (p) => setAuditPage(p),
                    style: { width: '100%', marginTop: 16 },
                  }}
                />
              </Card>
            ),
          },
        ]}
        />
      </PageListShell>

      <Drawer
        title={
          membersDrawer.role ? (
            <div style={{ minWidth: 0, width: '100%' }}>
              <Space align="center" size={10} wrap style={{ rowGap: 8 }}>
                <Typography.Text
                  ellipsis
                  style={{
                    margin: 0,
                    maxWidth: '100%',
                    fontSize: 18,
                    fontWeight: 600,
                    lineHeight: 1.35,
                    display: 'inline-block',
                    verticalAlign: 'middle',
                  }}
                >
                  {membersDrawer.role.name}
                </Typography.Text>
                <Tag color="processing" style={{ margin: 0, flexShrink: 0 }}>
                  {membersDrawer.role.code}
                </Tag>
              </Space>
            </div>
          ) : (
            '角色成员'
          )
        }
        placement="right"
        width={720}
        open={membersDrawer.open}
        onClose={() => setMembersDrawer({ open: false, role: null })}
        destroyOnClose
        styles={{
          header: {
            paddingTop: 16,
            paddingBottom: 14,
            paddingLeft: 12,
            paddingRight: 16,
          },
          body: { paddingTop: 12, paddingBottom: 24 },
        }}
        extra={(
          <Button
            type="primary"
            onClick={() => {
              const id = membersDrawer.role?.id
              setMembersDrawer({ open: false, role: null })
              if (id != null) navigate(`/users?admin_role_id=${id}`)
            }}
          >
            在用户管理中编辑
          </Button>
        )}
      >
        <div
          style={{
            marginBottom: 16,
            padding: '14px 16px',
            borderRadius: 8,
            background: 'var(--ant-color-fill-quaternary)',
            border: '1px solid var(--ant-color-border-secondary)',
          }}
        >
          {membersLoading ? (
            <Typography.Text type="secondary">正在加载成员列表…</Typography.Text>
          ) : (
            <>
              <Typography.Text type="secondary" style={{ display: 'block', lineHeight: 1.65 }}>
                已绑定账号{' '}
                <Typography.Text strong style={{ color: 'var(--ant-color-text)' }}>
                  {membersTotal}
                </Typography.Text>
                {' '}
                个（与「绑定用户数」一致）
                {membersTotal > 50 ? (
                  <Typography.Text type="secondary">；本页最多预览 50 条</Typography.Text>
                ) : null}
              </Typography.Text>
              <Typography.Paragraph
                type="secondary"
                style={{ marginTop: 10, marginBottom: 0, fontSize: 13, lineHeight: 1.65 }}
              >
                此处为只读预览。若需新增用户、修改绑定或删除账号，请使用右上角「在用户管理中编辑」。
              </Typography.Paragraph>
            </>
          )}
        </div>

        <Table<MemberRow>
          rowKey="id"
          size="middle"
          loading={membersLoading}
          dataSource={membersList}
          pagination={false}
          scroll={{ x: 'max-content', y: 'min(440px, calc(100vh - 300px))' }}
          locale={{
            emptyText: (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无账号绑定此角色" />
            ),
          }}
          columns={[
            { title: '登录名', dataIndex: 'username', ellipsis: true, width: 200 },
            { title: '昵称', dataIndex: 'nickname', ellipsis: true, width: 120 },
            {
              title: '人员身份',
              dataIndex: 'role',
              width: 100,
              render: (v: string) =>
                ({ employee: '用户', chef: '厨师', admin: '管理员' } as Record<string, string>)[v] ?? v,
            },
            { title: '公司', dataIndex: 'company_name', ellipsis: true, render: (v: string | null) => v || '—' },
          ]}
        />
      </Drawer>

      <Modal
        title={permModal.role ? `编辑权限 — ${permModal.role.name}` : '编辑权限'}
        open={permModal.open}
        onCancel={() => setPermModal({ open: false, role: null })}
        width={720}
        confirmLoading={permLoading}
        onOk={() => void savePerm()}
        destroyOnClose
      >
        <div style={{ maxHeight: 480, overflow: 'auto' }}>
          {groupedCatalog.map(([mod, items]) => (
            <div key={mod} style={{ marginBottom: 16 }}>
              <Typography.Text strong>{mod}</Typography.Text>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {items.map((p) => (
                  <Checkbox
                    key={p.key}
                    checked={selectedKeys.includes(p.key)}
                    onChange={(e) => {
                      setSelectedKeys((prev) => {
                        if (e.target.checked) return [...new Set([...prev, p.key])]
                        return prev.filter((x) => x !== p.key)
                      })
                    }}
                  >
                    {p.label}
                    <Typography.Text type="secondary" style={{ marginLeft: 6, fontSize: 12 }}>
                      {p.key}
                    </Typography.Text>
                  </Checkbox>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Modal>

      <Modal
        title="新建角色"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={async () => {
          const v = await createForm.validateFields()
          await adminApi.rbacCreateRole(v)
          message.success('已创建')
          setCreateOpen(false)
          createForm.resetFields()
          void loadRoles()
        }}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical">
          <Form.Item name="code" label="编码（英文）" rules={[{ required: true }]}>
            <Input placeholder="如 custom_ops" />
          </Form.Item>
          <Form.Item name="name" label="角色名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="说明">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
