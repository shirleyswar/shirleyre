import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'War Room 3',
}

export default function WarRoom3Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
