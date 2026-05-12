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

export const socketPlugin = fp(async (app: FastifyInstance) => {
  const io = new SocketIOServer(app.server, {
    cors: {
      origin: process.env.WEB_URL ?? 'http://localhost:3000',
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  })

  // Redis adapter: required for horizontal scaling (multiple API replicas).
  // Uses two separate Redis clients as required by socket.io/redis-adapter.
  const pubClient = createClient({ url: process.env.REDIS_URL ?? 'redis://localhost:6379' })
  const subClient = pubClient.duplicate()
  await Promise.all([pubClient.connect(), subClient.connect()])
  io.adapter(createAdapter(pubClient, subClient))
  app.log.info('Socket.IO Redis adapter connected')

  // Auth middleware: verify JWT for authenticated users; allow unauthenticated for display screens
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token as string | undefined
    if (!token) {
      socket.data.isDisplay = true
      return next()
    }
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

    // Doctor auto-joins their own broadcast room
    if (user?.role === 'doctor') {
      void socket.join(`doctor:${user.sub}`)
      io.to(`doctor:${user.sub}`).emit('doctor_status', { doctorId: user.sub, status: 'available' })
    }

    // Patient joins their own private room for direct notifications
    if (user) {
      void socket.join(`user:${user.sub}`)
    }

    socket.on('subscribe_doctor', (doctorId: string) => {
      void socket.join(`doctor:${doctorId}`)
    })

    socket.on('unsubscribe_doctor', (doctorId: string) => {
      void socket.leave(`doctor:${doctorId}`)
    })

    // TV display subscribes by clinicId
    socket.on('subscribe_clinic_queue', (clinicId: string) => {
      void socket.join(`clinic_queue:${clinicId}`)
    })

    // Receptionist/doctor dashboard subscribes by doctorId
    socket.on('subscribe_doctor_queue', (doctorId: string) => {
      void socket.join(`doctor_queue:${doctorId}`)
    })

    socket.on('disconnect', () => {
      if (user?.role === 'doctor') {
        io.to(`doctor:${user.sub}`).emit('doctor_status', { doctorId: user.sub, status: 'offline' })
      }
    })
  })

  app.decorate('io', io)

  app.addHook('onClose', async () => {
    await Promise.all([pubClient.quit(), subClient.quit()])
  })

  app.log.info('Socket.IO initialized')
})
