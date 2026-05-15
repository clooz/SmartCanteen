import { useState, useEffect } from 'react'
import { Card, Table, DatePicker, Button, Row, Col, Statistic, Typography, Tag, Space, Select, Empty } from 'antd'
import { BarChartOutlined, TeamOutlined, FireOutlined, ReloadOutlined } from '@ant-design/icons'
import PageListShell from '../../components/PageListShell'
import { textFilterDropdown } from '../../utils/tableColumnFilters'
import { tableListLocale, TableLoadErrorAlert } from '../../utils/tableListLocale'
import { filterBarRowStyle, filterBarCellStyle, filterBarLabelStyle } from '../../utils/filterToolbarLayout'
import { ordersApi } from '../../api/orders'
import { authApi } from '../../api/auth'
import dayjs, { Dayjs } from 'dayjs'

const { Text } = Typography
const { RangePicker } = DatePicker

export default function ReportPage() {
  const [loading, setLoading] = useState(false)
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().startOf('month'), dayjs(),
  ])
  const [companies, setCompanies] = useState<any[]>([])
  const [filterCompany, setFilterCompany] = useState<number>()
  const [reportData, setReportData] = useState<any>(null)
  const [loadError, setLoadError] = useState(false)

  const fetchCompanies = async () => {
    const res: any = await authApi.getCompanies()
    setCompanies(res.data || [])
  }

  useEffect(() => {
    fetchCompanies()
  }, [])

  const fetchReport = async () => {
    if (!dateRange) return
    setLoading(true)
    setLoadError(false)
    try {
      const res: any = await ordersApi.getReport({
        start_date: dateRange[0].format('YYYY-MM-DD'),
        end_date: dateRange[1].format('YYYY-MM-DD'),
        company_id: filterCompany,
      })
      setReportData(res.data)
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  const resetReportFilters = () => {
    setDateRange([dayjs().startOf('month'), dayjs()])
    setFilterCompany(undefined)
  }

  const totalOrders = reportData?.by_company?.reduce((s: number, r: any) => s + r.order_count, 0) || 0
  const totalAmount = reportData?.by_company?.reduce((s: number, r: any) => s + Number(r.total_amount), 0) || 0

  const companyColumns = reportData ? [
    {
      title: '公司',
      dataIndex: 'company_name',
      filterDropdown: textFilterDropdown('筛选公司名', () => {}),
      onFilter: (value: any, r: any) =>
        !value || `${r.company_code || ''} ${r.company_name || ''}`.toLowerCase().includes(String(value).toLowerCase()),
      render: (v: string, r: any) => <><Tag>{r.company_code}</Tag>{v || '未知'}</>,
    },
    {
      title: '订单数',
      dataIndex: 'order_count',
      align: 'right' as const,
      sorter: (a: any, b: any) => a.order_count - b.order_count,
    },
    {
      title: '消费金额',
      dataIndex: 'total_amount',
      align: 'right' as const,
      sorter: (a: any, b: any) => Number(a.total_amount) - Number(b.total_amount),
      render: (v: string) => <Text strong>¥{Number(v).toFixed(2)}</Text>,
    },
  ] : []

  const topDishColumns = reportData ? [
    {
      title: '排名',
      width: 56,
      align: 'center' as const,
      render: (_: any, __: any, i: number) => (
        <Tag color={i < 3 ? 'red' : 'default'}>{i + 1}</Tag>
      ),
    },
    {
      title: '菜品',
      dataIndex: 'dish_name',
      filterDropdown: textFilterDropdown('筛选菜品', () => {}),
      onFilter: (value: any, r: any) =>
        !value || String(r.dish_name || '').toLowerCase().includes(String(value).toLowerCase()),
    },
    {
      title: '销量',
      dataIndex: 'total_qty',
      sorter: (a: any, b: any) => a.total_qty - b.total_qty,
      render: (v: number) => `${v} 份`,
    },
    {
      title: '销售额',
      dataIndex: 'total_amount',
      align: 'right' as const,
      sorter: (a: any, b: any) => Number(a.total_amount) - Number(b.total_amount),
      render: (v: string) => `¥${Number(v).toFixed(2)}`,
    },
  ] : []

  const dateTrendColumns = reportData ? [
    {
      title: '日期',
      dataIndex: 'date',
      filterDropdown: textFilterDropdown('筛选日期', () => {}),
      onFilter: (value: any, r: any) =>
        !value || String(r.date || '').includes(String(value)),
    },
    {
      title: '订单数',
      dataIndex: 'order_count',
      align: 'right' as const,
      sorter: (a: any, b: any) => a.order_count - b.order_count,
    },
    {
      title: '消费金额',
      dataIndex: 'total_amount',
      align: 'right' as const,
      sorter: (a: any, b: any) => Number(a.total_amount) - Number(b.total_amount),
      render: (v: string) => `¥${Number(v).toFixed(2)}`,
    },
  ] : []

  return (
    <div>
      <PageListShell
        title="消费报表"
        filterBar={
          <div style={filterBarRowStyle}>
            <div style={filterBarCellStyle(280)}>
              <Text type="secondary" style={filterBarLabelStyle}>统计区间</Text>
              <RangePicker
                value={dateRange}
                onChange={(v) => v && setDateRange(v as [Dayjs, Dayjs])}
                style={{ flex: 1, minWidth: 220, maxWidth: '100%' }}
              />
            </div>
            <div style={filterBarCellStyle(160)}>
              <Text type="secondary" style={filterBarLabelStyle}>所属公司</Text>
              <Select
                placeholder="全部公司"
                allowClear
                style={{ flex: 1, minWidth: 120, maxWidth: '100%' }}
                value={filterCompany}
                onChange={setFilterCompany}
              >
                {companies.map((c: any) => (
                  <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>
                ))}
              </Select>
            </div>
            <div style={filterBarCellStyle(220, 'flex-end')}>
              <Space>
                <Button onClick={resetReportFilters}>重置条件</Button>
                <Button type="primary" icon={<ReloadOutlined />} onClick={fetchReport} loading={loading}>查询</Button>
              </Space>
            </div>
          </div>
        }
      >
        <TableLoadErrorAlert error={loadError} onRetry={fetchReport} />
        {!reportData ? (
          <div style={{ padding: '40px 0 48px' }}>
            <Empty description={<Text type="secondary">选择日期范围与公司后点击「查询」查看报表</Text>} />
          </div>
        ) : (
          <div style={{ paddingBottom: 24 }}>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col xs={24} sm={8}>
                <Card>
                  <Statistic title="总订单数" value={totalOrders} prefix={<BarChartOutlined />} />
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card>
                  <Statistic title="总消费金额" value={totalAmount.toFixed(2)} prefix="¥"
                    valueStyle={{ color: '#0F172A' }} />
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card>
                  <Statistic title="涉及公司数" value={reportData.by_company?.length || 0}
                    prefix={<TeamOutlined />} />
                </Card>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} lg={12}>
                <Card title={<Space><TeamOutlined /> 按公司汇总</Space>} style={{ marginBottom: 16 }}>
                  <Table size="small" pagination={false} dataSource={reportData.by_company} rowKey="company_code"
                    columns={companyColumns}
                    locale={tableListLocale}
                  />
                </Card>
              </Col>
              <Col xs={24} lg={12}>
                <Card title={<Space><FireOutlined /> 热销菜品 TOP10</Space>}>
                  <Table size="small" pagination={false} dataSource={reportData.top_dishes} rowKey="dish_name"
                    columns={topDishColumns}
                    locale={tableListLocale}
                  />
                </Card>
              </Col>
            </Row>

            <Card title="按日期趋势" style={{ marginTop: 0 }}>
              <Table size="small" pagination={false} dataSource={reportData.by_date} rowKey="date"
                columns={dateTrendColumns}
                locale={tableListLocale}
              />
            </Card>
          </div>
        )}
      </PageListShell>
    </div>
  )
}
