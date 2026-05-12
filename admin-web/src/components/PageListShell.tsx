import { Card, Typography, Space } from 'antd'
import type { ReactNode } from 'react'

const { Title, Text } = Typography

export type PageListShellProps = {
  title: string
  subtitle?: ReactNode
  headerExtra?: ReactNode
  /** 默认用 Card 包裹内容（与菜品管理一致）；看板等全宽页面用 plain */
  variant?: 'card' | 'plain'
  filterLeft?: ReactNode
  filterRight?: ReactNode
  children: ReactNode
}

/**
 * 管理端内容区统一壳：页标题 + 可选筛选栏 + 卡片内容区（与菜品管理列表页一致）
 */
export default function PageListShell({
  title,
  subtitle,
  headerExtra,
  variant = 'card',
  filterLeft,
  filterRight,
  children,
}: PageListShellProps) {
  const hasFilter = filterLeft != null || filterRight != null

  const header = (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: subtitle ? 'flex-start' : 'center',
        marginBottom: 16,
      }}
    >
      <div>
        <Title level={4} style={{ margin: 0 }}>
          {title}
        </Title>
        {subtitle ? (
          <Text type="secondary" style={{ fontSize: 13, display: 'block', marginTop: 2 }}>
            {subtitle}
          </Text>
        ) : null}
      </div>
      {headerExtra != null ? <div style={{ flexShrink: 0 }}>{headerExtra}</div> : null}
    </div>
  )

  const filterRow =
    hasFilter ? (
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <Space wrap style={{ alignItems: 'center' }}>
          {filterLeft}
        </Space>
        <Space style={{ marginLeft: 'auto' }}>{filterRight}</Space>
      </div>
    ) : null

  if (variant === 'plain') {
    return (
      <div>
        {header}
        {filterRow}
        {children}
      </div>
    )
  }

  return (
    <div>
      {header}
      <Card styles={{ body: { paddingBottom: 0 } }}>
        {filterRow}
        {children}
      </Card>
    </div>
  )
}

/** 与菜品管理列表一致的分页器配置 */
export function standardTablePagination(params: {
  current: number
  total: number
  pageSize: number
  onChange: (page: number, pageSize: number) => void
}) {
  return {
    current: params.current,
    total: params.total,
    pageSize: params.pageSize,
    showSizeChanger: true,
    pageSizeOptions: ['10', '20', '50'],
    showTotal: (t: number) => `共 ${t} 条`,
    onChange: params.onChange,
  }
}
