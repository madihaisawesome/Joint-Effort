import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const here = path.dirname(fileURLToPath(import.meta.url))
const modelPath = path.resolve(here, '../public/models/pose_landmarker_lite.task')

function sendPoseModel(req, res, next) {
  const url = req.url?.split('?')[0]
  if (url !== '/models/pose_landmarker_lite.task') return next()
  if (!fs.existsSync(modelPath)) return next()
  res.setHeader('Content-Type', 'application/octet-stream')
  fs.createReadStream(modelPath).pipe(res)
}

function poseModel() {
  return {
    name: 'pose-model',
    configureServer(server) {
      server.middlewares.use(sendPoseModel)
    },
    configurePreviewServer(server) {
      server.middlewares.use(sendPoseModel)
    },
    closeBundle() {
      if (!fs.existsSync(modelPath)) return
      const destDir = path.resolve(here, 'dist/models')
      fs.mkdirSync(destDir, { recursive: true })
      fs.copyFileSync(modelPath, path.join(destDir, 'pose_landmarker_lite.task'))
    },
  }
}

export default defineConfig({
  plugins: [react(), poseModel()],
})
