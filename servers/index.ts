import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { chatHandler } from './routes/chat.js'
import { healthHandler } from './routes/health.js'
import { parseUrlHandler } from './routes/parse-url.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()
const PORT = process.env.PORT || 8787

// CORS 配置
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Access-Password', 'X-Custom-LLM'],
  exposedHeaders: ['X-Quota-Exempt'],
}))

// JSON 解析
app.use(express.json({ limit: '50mb' }))

// API 路由
app.get('/api/health', healthHandler)
app.post('/api/chat', chatHandler)
app.post('/api/parse-url', parseUrlHandler)

// 静态文件服务（前端）
const distPath = path.join(__dirname, '../dist')
app.use(express.static(distPath))

// SPA 路由回退
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`)
  console.log(`📁 Serving static files from: ${distPath}`)
})

