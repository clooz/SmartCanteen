import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
    // 预热入口文件，避免首次访问时空白等待
    warmup: {
      clientFiles: ['./src/main.tsx', './src/App.tsx'],
    },
  },
  // 预声明所有依赖，让 Vite 在服务就绪前完成打包，首次访问不再出现空白页
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'react-router-dom',
      'antd',
      'antd/locale/zh_CN',
      '@ant-design/icons',
      'axios',
      'dayjs',
      'socket.io-client',
    ],
  },
})
