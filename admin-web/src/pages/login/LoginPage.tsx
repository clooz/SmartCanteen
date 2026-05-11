import { Form, Input, Button, Card, Typography, message } from 'antd'
import { UserOutlined, LockOutlined, CoffeeOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../../api/auth'
import { authStore } from '../../store/authStore'

const { Title, Text } = Typography

export default function LoginPage() {
  const [form] = Form.useForm()
  const navigate = useNavigate()

  const handleLogin = async (values: { username: string; password: string }) => {
    try {
      const res: any = await authApi.login(values)
      authStore.setAuth(res.data.token, res.data.user)
      message.success('登录成功')
      navigate('/', { replace: true })
    } catch {
      // 错误已在拦截器统一处理
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f5f5f5',
    }}>
      <Card style={{ width: 400 }} variant="borderless" styles={{ body: { padding: 40 } }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <CoffeeOutlined style={{ fontSize: 40, color: '#1677ff' }} />
          <Title level={3} style={{ marginTop: 12, marginBottom: 4 }}>智能食堂管理系统</Title>
          <Text type="secondary">厨师 / 管理员登录</Text>
        </div>

        <Form form={form} onFinish={handleLogin} size="large" autoComplete="off">
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>

          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" block>
              登 录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
