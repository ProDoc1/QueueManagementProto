'use client'

import { io, type Socket } from 'socket.io-client'

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:4000'

let socket: Socket | null = null

export function getSocket(token?: string): Socket {
  if (!socket || !socket.connected) {
    socket = io(SOCKET_URL, {
      auth: token ? { token } : {},
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })
  }
  return socket
}

export function disconnectSocket() {
  socket?.disconnect()
  socket = null
}
