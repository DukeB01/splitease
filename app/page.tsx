import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-dvh bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900 flex flex-col overflow-x-hidden">
      <nav className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-[10px] sm:text-xs">HK</div>
          <span className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Hisaab Kitaab</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/login" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">Login</Link>
          <Link href="/signup" className="text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-700 text-white px-3 sm:px-4 py-2 rounded-xl font-medium transition-colors">Get Started</Link>
        </div>
      </nav>

      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-8 sm:py-0">
        <div className="max-w-2xl w-full text-center">
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold text-gray-900 dark:text-white leading-tight">
            Split expenses,<br />
            <span className="text-emerald-600">simplified.</span>
          </h1>
          <p className="mt-4 sm:mt-6 text-base sm:text-lg text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            Track personal spending, split group bills, and settle debts — all in one clean, free app.
          </p>
          <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/signup" className="inline-flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white px-6 sm:px-8 py-3 rounded-xl font-medium text-base sm:text-lg transition-colors shadow-lg shadow-emerald-600/20">
              Start for Free
            </Link>
            <Link href="/login" className="inline-flex items-center justify-center bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 px-6 sm:px-8 py-3 rounded-xl font-medium text-base sm:text-lg transition-colors border border-gray-200 dark:border-gray-700">
              Sign In
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mt-12 sm:mt-16 text-center">
            {[
              { icon: '👥', title: 'Group Splits', desc: 'Equal or custom splits with smart settlement' },
              { icon: '📊', title: 'Track Spending', desc: 'Categorize expenses with visual charts' },
              { icon: '💡', title: 'Smart Settle', desc: 'Minimize transactions with our algorithm' },
            ].map((f) => (
              <div key={f.title} className="flex sm:flex-col items-center sm:items-center gap-3 sm:gap-0 p-4 sm:p-0 rounded-xl bg-white/60 dark:bg-gray-800/40 sm:bg-transparent sm:dark:bg-transparent">
                <div className="text-2xl sm:text-3xl sm:mb-2">{f.icon}</div>
                <div className="text-left sm:text-center">
                  <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{f.title}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 sm:mt-1">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
