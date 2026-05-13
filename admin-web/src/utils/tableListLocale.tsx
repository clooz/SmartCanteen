import { Empty, Alert, Button, Space } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'

/** 列表 Table 统一空状态 */
export const tableListLocale = {
  emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />,
}

export function TableLoadErrorAlert(props: {
  error: boolean
  onRetry: () => void
}) {
  if (!props.error) return null
  return (
    <Alert
      type="error"
      showIcon
      style={{ marginBottom: 16 }}
      message="数据加载失败"
      description={(
        <Space direction="vertical" size="small">
          <span>请检查网络或稍后重试。</span>
          <Button type="primary" size="small" icon={<ReloadOutlined />} onClick={props.onRetry}>
            重新加载
          </Button>
        </Space>
      )}
    />
  )
}
