import PatientShell from '@/components/layouts/PatientShell'

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  return <PatientShell>{children}</PatientShell>
}
