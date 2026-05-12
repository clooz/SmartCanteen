import { Button, Input, Space } from 'antd'
import type { FilterDropdownProps } from 'antd/es/table/interface'

const DROPDOWN_PAD = { padding: 8 } as const

/** 与菜品管理「菜品名称」列一致的文本筛选下拉 */
export function textFilterDropdown(
  placeholder: string,
  onApply: (value: string | undefined) => void
) {
  return ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: FilterDropdownProps) => (
    <div style={DROPDOWN_PAD}>
      <Input
        placeholder={placeholder}
        value={selectedKeys[0] as string | undefined}
        onChange={e => setSelectedKeys(e.target.value ? [e.target.value] : [])}
        onPressEnter={() => {
          onApply(selectedKeys[0] ? String(selectedKeys[0]).trim() : undefined)
          confirm()
        }}
        style={{ marginBottom: 8, display: 'block' }}
      />
      <Space>
        <Button
          type="primary"
          size="small"
          onClick={() => {
            onApply(selectedKeys[0] ? String(selectedKeys[0]).trim() : undefined)
            confirm()
          }}
        >
          搜索
        </Button>
        <Button
          size="small"
          onClick={() => {
            clearFilters?.()
            onApply(undefined)
            confirm()
          }}
        >
          重置
        </Button>
      </Space>
    </div>
  )
}
