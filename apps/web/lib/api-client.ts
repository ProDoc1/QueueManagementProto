const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

type RequestOptions = {
  method?: string
  body?: unknown
  token?: string
}

export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`

  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method ?? 'GET',
    credentials: 'include',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw Object.assign(new Error(err.error ?? 'Request failed'), { status: res.status })
  }

  return res.json()
}
