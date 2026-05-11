import { useState } from 'react'
import { Card, Table, DatePicker, Button, Row, Col, Statistic, Typography, Tag, Space, Select } from 'antd'
import { BarChartOutlined, TeamOutlined, FireOutlined } from '@ant-design/icons'
import { ordersApi } from '../../api/orders'
import { adminApi } from '../../api/admin'
import dayjs, { Dayjs } from 'dayjs'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

export default function ReportPage() {
  const [loading, setLoading] = useState(false)
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().startOf('month'), dayjs(),
  ])
  const [companies, setCompanies] = useState<any[]>([])
  const [filterCompany, setFilterCompany] = useState<number>()
  const [reportData, setReportData] = useState<any>(null)

  const fetchCompanies = async () => {
    const res: any = await adminApi.getCompanies()
    setCompanies(res.data || [])
  }

  useState(() => { fetchCompanies() })

  const fetchReport = async () => {
    if (!dateRange) return
    setLoading(true)
    try {
      const res: any = await ordersApi.getReport({
        start_date: dateRange[0].format('YYYY-MM-DD'),
        end_date: dateRange[1].format('YYYY-MM-DD'),
        company_id: filterCompany,
      })
      setReportData(res.data)
    } finally {
      setLoading(false)
    }
  }

  const totalOrders = reportData?.by_company?.reduce((s: number, r: any) => s + r.order_count, 0) || 0
  const totalAmount = reportData?.by_company?.reduce((s: number, r: any) => s + Number(r.total_amount), 0) || 0

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>消费报表</Title>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <RangePicker
            value={dateRange}
            onChange={(v) => v && setDateRange(v as [Dayjs, Dayjs])}
          />
          <Select placeholder="全部公司" allowClear style={{ width: 140 }}
            value={filterCompany} onChange={setFilterCompany}>
            {companies.map((c: any) => (
              <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>
            ))}
          </Select>
          <Button type="primary" onClick={fetchReport} loading={loading}>查询</Button>
        </Space>
      </Card>

      {reportData && (
        <>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={8}>
              <Card>
                <Statistic title="总订单数" value={totalOrders} prefix={<BarChartOutlined />} />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic title="总消费金额" value={totalAmount.toFixed(2)} prefix="¥"
                  valueStyle={{ color: '#f5a623' }} />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic title="涉及公司数" value={reportData.by_company?.length || 0}
                  prefix={<TeamOutlined />} />
              </Card>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Card title={<><TeamOutlined /> 按公司汇总</>} style={{ marginBottom: 16 }}>
                <Table size="small" pagination={false} dataSource={reportData.by_company} rowKey="company_code"
                  columns={[
                    { title: '公司', dataIndex: 'company_name', render: (v: string, r: any) => <><Tag>{r.company_code}</Tag>{v || '未知'}</> },
                    { title: '订单数', dataIndex: 'order_count' },
                    { title: '消费金额', dataIndex: 'total_amount', render: (v: string) => <Text strong>¥{Number(v).toFixed(2)}</Text> },
                  ]}
                />
              </Card>
            </Col>
            <Col span={12}>
              <Card title={<><FireOutlined /> 热销菜品 TOP10</>}>
                <Table size="small" pagination={false} dataSource={reportData.top_dishes} rowKey="dish_name"
                  columns={[
                    {
                      title: '排名', width: 50,
                      render: (_: any, __: any, i: number) => (
                        <Tag color={i < 3 ? 'red' : 'default'}>{i + 1}</Tag>
                      ),
                    },
                    { title: '菜品', dataIndex: 'dish_name' },
                    { title: '销量', dataIndex: 'total_qty', render: (v: number) => `${v} 份` },
                    { title: '销售额', dataIndex: 'total_amount', render: (v: string) => `¥${Number(v).toFixed(2)}` },
                  ]}
                />
              </Card>
            </Col>
          </Row>

          <Card title="按日期趋势" style={{ marginTop: 16 }}>
            <Table size="small" pagination={false} dataSource={reportData.by_date} rowKey="date"
              columns={[
                { title: '日期', dataIndex: 'date' },
                { title: '订单数', dataIndex: 'order_count' },
                { title: '消费金额', dataIndex: 'total_amount', render: (v: string) => `¥${Number(v).toFixed(2)}` },
              ]}
            />
          </Card>
        </>
      )}
    </div>
  )
}
