import { BottomNav, Sidebar } from '@/components/nav'
import { TopBar } from '@/components/top-bar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopBar />
        <main className="flex-1 pb-20 sm:pb-0">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
