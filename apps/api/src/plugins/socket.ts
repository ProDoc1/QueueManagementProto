import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import { Server as SocketIOServer } from 'socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import { createClient } from 'redis'
import type { JwtPayload } from '@repo/types'

declare module 'fastify' {
  interface FastifyInstance {
    io: SocketIOServer
  }
}

/** Connect a Redis client with a hard timeout — resolves null if unavailable. */
async function tryRedisConnect(url: string, timeoutMs = 2000) {
  const client = createClient({
    url,
    socket: { connectTimeout: timeoutMs, reconnectStrategy: false },
  })
  try {
    await Promise.race([
      client.connect(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Redis connect timeout')), timeoutMs)
      ),
    ])
    return client
  } catch {
    try { client.destroy() } catch { /* ignore */ }
    return null
  }
}

export const socketPlugin = fp(async (app: FastifyInstance) => {
  const io = new SocketIOServer(app.server, {
    cors: {
      origin: process.env.WEB_URL ?? 'http://localhost:3000',
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  })

  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379'
  const pubClient = await tryRedisConnect(redisUrl)
  if (pubClient) {
    const subClient = pubClient.duplicate()
    try {
      await subClient.connect()
      io.adapter(createAdapter(pubClient, subClient))
      app.log.info('Socket.IO Redis adapter connected')
      app.addHook('onClose', async () => {
        try { await Promise.all([pubClient.quit(), subClient.quit()]) } catch { /* ignore */ }
      })
    } catch {
      app.log.warn('Socket.IO using in-memory adapter (Redis sub-client failed)')
    }
  } else {
    app.log.warn('Socket.IO using in-memory adapter — Redis unavailable')
  }

  // Auth middleware
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token as string | undefined
    if (!token) { socket.data.isDisplay = true; return next() }
    try {
      const payload = app.jwt.verify<JwtPayload>(token)
      socket.data.user = payload
      next()
    } catch {
      next(new Error('Unauthorized'))
    }
  })

  io.on('connection', (socket) => {
    const user = socket.data.user as JwtPayload | undefined
    if (user?.role === 'doctor') {
      void socket.join(`doctor:${user.sub}`)
      io.to(`doctor:${user.sub}`).emit('doctor_status', { doctorId: user.sub, status: 'available' })
    }
    if (user) void socket.join(`user:${user.sub}`)
    socket.on('subscribe_doctor',       (id: string) => { void socket.join(`doctor:${id}`) })
    socket.on('unsubscribe_doctor',     (id: string) => { void socket.leave(`doctor:${id}`) })
    socket.on('subscribe_clinic_queue', (id: string) => { void socket.join(`clinic_queue:${id}`) })
    socket.on('subscribe_doctor_queue', (id: string) => { void socket.join(`doctor_queue:${id}`) })
    socket.on('disconnect', () => {
      if (user?.role === 'doctor')
        io.to(`doctor:${user.sub}`).emit('doctor_status', { doctorId: user.sub, status: 'offline' })
    })
  })

  app.decorate('io', io)
  app.log.info('Socket.IO initialized')
})
