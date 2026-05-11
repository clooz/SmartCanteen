import { Form, Input, Button, Typography, message } from 'antd'
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
      background: '#f5f7fa',
    }}>
      <div style={{ width: 380 }}>
        {/* 品牌区 */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 48, height: 48,
            borderRadius: 14,
            background: '#1890ff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 8px 24px rgba(24,144,255,0.3)',
          }}>
            <CoffeeOutlined style={{ fontSize: 24, color: '#fff' }} />
          </div>
          <Title level={3} style={{ margin: '0 0 6px', fontWeight: 700, letterSpacing: '-0.02em' }}>
            智能食堂管理系统
          </Title>
          <Text type="secondary" style={{ fontSize: 14 }}>
            厨师 / 管理员登录
          </Text>
        </div>

        {/* 登录卡片 */}
        <div style={{
          background: '#fff',
          borderRadius: 16,
          padding: '32px 32px 28px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
          border: '1px solid #f0f0f0',
        }}>
          <Form form={form} onFinish={handleLogin} size="large" autoComplete="off" layout="vertical">
            <Form.Item
              name="username"
              label={<Text style={{ fontWeight: 500, fontSize: 13 }}>用户名</Text>}
              rules={[{ required: true, message: '请输入用户名' }]}
              style={{ marginBottom: 16 }}
            >
              <Input
                prefix={<UserOutlined style={{ color: '#9ca3af' }} />}
                placeholder="请输入用户名"
                style={{ borderRadius: 8, height: 42 }}
              />
            </Form.Item>

            <Form.Item
              name="password"
              label={<Text style={{ fontWeight: 500, fontSize: 13 }}>密码</Text>}
              rules={[{ required: true, message: '请输入密码' }]}
              style={{ marginBottom: 24 }}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#9ca3af' }} />}
                placeholder="请输入密码"
                style={{ borderRadius: 8, height: 42 }}
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button
                type="primary"
                htmlType="submit"
                block
                style={{
                  height: 42,
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 15,
                  boxShadow: '0 4px 12px rgba(24,144,255,0.35)',
                }}
              >
                登 录
              </Button>
            </Form.Item>
          </Form>
        </div>
      </div>
    </div>
  )
}
