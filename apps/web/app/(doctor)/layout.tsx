import AdminShell from '@/components/layouts/AdminShell'

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>
}
