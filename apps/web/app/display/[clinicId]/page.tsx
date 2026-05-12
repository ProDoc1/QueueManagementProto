import QueueDisplay from './QueueDisplay'

interface Props {
  params: Promise<{ clinicId: string }>
}

async function fetchQueueState(clinicId: string) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  try {
    const res = await fetch(`${apiUrl}/api/queue/display/${clinicId}`, { cache: 'no-store' })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

export default async function DisplayPage({ params }: Props) {
  const { clinicId } = await params
  const initial = await fetchQueueState(clinicId)
  return <QueueDisplay clinicId={clinicId} initial={initial} />
}

export const metadata = {
  title: 'Queue Display',
}
