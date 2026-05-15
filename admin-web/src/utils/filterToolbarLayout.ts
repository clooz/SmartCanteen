import type { CSSProperties } from 'react'

/** 与菜品管理等页一致的整行筛选区外层（等分 + 换行） */
export const filterBarRowStyle: CSSProperties = {
  display: 'flex',
  width: '100%',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 12,
}

/** 筛选项一格：横向等分，控件可用 flex:1 撑满本格 */
export function filterBarCellStyle(
  minWidth: number,
  justify: 'flex-start' | 'center' | 'flex-end' = 'flex-start',
): CSSProperties {
  return {
    flex: '1 1 0',
    minWidth,
    display: 'flex',
    alignItems: 'center',
    justifyContent: justify,
    gap: 8,
    flexWrap: 'wrap',
  }
}

/** 与 Typography.Text type="secondary" 搭配：筛选项标签 */
export const filterBarLabelStyle: CSSProperties = { fontSize: 13, flexShrink: 0 }
