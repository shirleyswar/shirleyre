import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'War Room',
}

export default function WarRoomLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
