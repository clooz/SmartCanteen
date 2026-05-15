import { Card, Typography, Space } from 'antd'
import type { ReactNode } from 'react'

const { Title, Text } = Typography

export type PageListShellProps = {
  title: string
  subtitle?: ReactNode
  headerExtra?: ReactNode
  /** 默认用 Card 包裹内容（与菜品管理一致）；看板等全宽页面用 plain */
  variant?: 'card' | 'plain'
  /** 整行筛选区（与 filterLeft / filterRight 互斥，传入时仅渲染此项） */
  filterBar?: ReactNode
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
  filterBar,
  filterLeft,
  filterRight,
  children,
}: PageListShellProps) {
  const hasFilter = filterBar != null || filterLeft != null || filterRight != null

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
        <Title level={5} style={{ margin: 0 }}>
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
      filterBar != null ? (
        <div style={{ width: '100%', marginBottom: 16 }}>{filterBar}</div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            width: '100%',
            marginBottom: 16,
            gap: 12,
          }}
        >
          <Space wrap style={{ flex: '1 1 auto', minWidth: 0, alignItems: 'center' }}>
            {filterLeft}
          </Space>
          {filterRight != null ? (
            <Space style={{ flexShrink: 0, marginLeft: 'auto', alignItems: 'center' }}>{filterRight}</Space>
          ) : null}
        </div>
      )
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
