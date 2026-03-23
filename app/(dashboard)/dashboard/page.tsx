'use client'

import { useEffect, useState, useMemo, lazy, Suspense } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useUser } from '@/lib/hooks'
import { Card } from '@/components/ui/card'
import { PersonalExpense, GroupExpense, Income } from '@/lib/types'
import Link from 'next/link'
import dynamic from 'next/dynamic'

// Lazy-load recharts — it's huge and blocks first paint on mobile
const Charts = dynamic(() => import('@/components/dashboard-charts'), { ssr: false, loading: () => <ChartSkeleton /> })

const CATEGORY_EMOJI: Record<string, string> = {
  'Food & Dining': '🍕', 'Rent & Housing': '🏠', 'Transport': '🚗', 'Shopping': '🛒',
  'Entertainment': '🎬', 'Health': '💊', 'Travel': '✈️', 'Utilities': '💡', 'Education': '📚', 'Other': '📌',
}

type DateFilter = 'this_month' | 'last_month' | 'custom'

function getDateRange(filter: DateFilter, customFrom: string, customTo: string) {
  const now = new Date()
  if (filter === 'this_month') {
    return { from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), to: fmt(new Date(now.getFullYear(), now.getMonth() + 1, 0)) }
  }
  if (filter === 'last_month') {
    return { from: fmt(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: fmt(new Date(now.getFullYear(), now.getMonth(), 0)) }
  }
  return { from: customFrom, to: customTo }
}

function fmt(d: Date) { return d.toISOString().split('T')[0] }

function ChartSkeleton() {
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <Card><div className="h-64 animate-pulse bg-gray-100 dark:bg-gray-800 rounded-xl" /></Card>
      <Card><div className="h-64 animate-pulse bg-gray-100 dark:bg-gray-800 rounded-xl" /></Card>
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useUser()
  const supabase = createClient()
  const [allExpenses, setAllExpenses] = useState<PersonalExpense[]>([])
  const [allIncome, setAllIncome] = useState<Income[]>([])
  const [youOwe, setYouOwe] = useState(0)
  const [youAreOwed, setYouAreOwed] = useState(0)
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)

  const [dateFilter, setDateFilter] = useState<DateFilter>('this_month')
  const [customFrom, setCustomFrom] = useState(fmt(new Date()))
  const [customTo, setCustomTo] = useState(fmt(new Date()))

  const { from, to } = getDateRange(dateFilter, customFrom, customTo)

  useEffect(() => {
    if (!user) return
    const load = async () => {
      // Fire all independent queries in parallel
      const [expResult, incResult, gmResult] = await Promise.all([
        supabase.from('personal_expenses').select('*').order('date', { ascending: false }),
        supabase.from('income').select('*').order('date', { ascending: false }),
        supabase.from('group_members').select('group_id, groups(id, name)').eq('user_id', user.id),
      ])

      setAllExpenses(expResult.data || [])
      setAllIncome(incResult.data || [])

      const grps = (gmResult.data || []).map((m: any) => m.groups).filter(Boolean)
      setGroups(grps)

      // Fetch ALL group expenses in ONE query instead of N queries
      if (grps.length > 0) {
        const groupIds = grps.map((g: any) => g.id)
        const { data: allGroupExpenses } = await supabase
          .from('group_expenses')
          .select('paid_by, splits:expense_splits(user_id, amount)')
          .in('group_id', groupIds)

        let owe = 0, owed = 0
        for (const exp of (allGroupExpenses || []) as any[]) {
          if (exp.paid_by === user.id) {
            owed += exp.splits
              .filter((s: any) => s.user_id !== user.id)
              .reduce((sum: number, s: any) => sum + Number(s.amount), 0)
          } else {
            const mySplit = exp.splits.find((s: any) => s.user_id === user.id)
            if (mySplit) owe += Number(mySplit.amount)
          }
        }
        setYouOwe(owe)
        setYouAreOwed(owed)
      }
      setLoading(false)
    }
    load()
  }, [user])

  const filteredExpenses = useMemo(() =>
    allExpenses.filter(e => e.date >= from && e.date <= to), [allExpenses, from, to])

  const filteredIncome = useMemo(() =>
    allIncome.filter(e => e.date >= from && e.date <= to), [allIncome, from, to])

  const totalExpense = filteredExpenses.reduce((s, e) => s + Number(e.amount), 0)
  const totalIncome = filteredIncome.reduce((s, e) => s + Number(e.amount), 0)
  const savings = totalIncome - totalExpense

  const filterLabel = dateFilter === 'this_month' ? 'This Month' : dateFilter === 'last_month' ? 'Last Month' : `${from} to ${to}`

  if (loading) {
    return (
      <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-4">
        <div className="h-8 w-40 animate-pulse bg-gray-200 dark:bg-gray-800 rounded-lg" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="h-28 animate-pulse bg-gray-100 dark:bg-gray-800 rounded-2xl" />)}
        </div>
        <ChartSkeleton />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-4 sm:space-y-6">
      {/* Header + filter */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm mt-0.5">{filterLabel}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {(['this_month', 'last_month', 'custom'] as const).map((f) => (
            <button key={f} onClick={() => setDateFilter(f)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-medium transition-colors ${dateFilter === f ? 'bg-emerald-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}
            >{f === 'this_month' ? 'This Mo' : f === 'last_month' ? 'Last Mo' : 'Custom'}</button>
          ))}
        </div>
      </div>

      {dateFilter === 'custom' && (
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-xs text-gray-900 dark:text-gray-100 focus:border-emerald-500 focus:outline-none" />
          <span className="text-xs text-gray-400">to</span>
          <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-xs text-gray-900 dark:text-gray-100 focus:border-emerald-500 focus:outline-none" />
        </div>
      )}

      {/* KPI Cards — compact on mobile */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <Card className="!p-3 sm:!p-5 border-emerald-200 dark:border-emerald-800">
          <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">Income</p>
          <p className="text-lg sm:text-2xl font-bold text-emerald-600 mt-0.5">₹{totalIncome.toLocaleString()}</p>
          <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5">{filteredIncome.length} entries</p>
        </Card>
        <Card className="!p-3 sm:!p-5 border-red-200 dark:border-red-800">
          <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">Expense</p>
          <p className="text-lg sm:text-2xl font-bold text-red-500 mt-0.5">₹{totalExpense.toLocaleString()}</p>
          <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5">{filteredExpenses.length} txns</p>
        </Card>
        <Card className={`!p-3 sm:!p-5 ${savings >= 0 ? 'border-emerald-200 dark:border-emerald-800' : 'border-red-200 dark:border-red-800'}`}>
          <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">Savings</p>
          <p className={`text-lg sm:text-2xl font-bold mt-0.5 ${savings >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {savings < 0 ? '-' : ''}₹{Math.abs(savings).toLocaleString()}
          </p>
          <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5">{savings >= 0 ? 'Under budget' : 'Over budget'}</p>
        </Card>
        <Card className="!p-3 sm:!p-5">
          <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">You Owe</p>
          <p className="text-lg sm:text-2xl font-bold text-orange-500 mt-0.5">₹{youOwe.toLocaleString()}</p>
          <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5">To others</p>
        </Card>
      </div>

      {/* Charts — lazy loaded */}
      <Charts filteredExpenses={filteredExpenses} filterLabel={filterLabel} />

      {/* Groups */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Your Groups</h3>
          <Link href="/groups" className="text-xs text-emerald-600 hover:underline">View all</Link>
        </div>
        {groups.length === 0 ? (
          <p className="text-sm text-gray-400">No groups yet. <Link href="/groups" className="text-emerald-600 hover:underline">Create one</Link></p>
        ) : (
          <div className="space-y-1">
            {groups.slice(0, 5).map((g) => (
              <Link key={g.id} href={`/groups/${g.id}`} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 font-semibold text-sm">
                  {g.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{g.name}</span>
              </Link>
            ))}
          </div>
        )}
      </Card>

      {/* Recent Expenses */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Recent Expenses</h3>
          <Link href="/expenses" className="text-xs text-emerald-600 hover:underline">View all</Link>
        </div>
        {filteredExpenses.length === 0 ? (
          <p className="text-sm text-gray-400">No expenses in this period.</p>
        ) : (
          <div className="space-y-1">
            {filteredExpenses.slice(0, 5).map((e) => (
              <div key={e.id} className="flex items-center gap-3 py-2">
                <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-sm">
                  {CATEGORY_EMOJI[e.category] || '📌'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{e.description}</p>
                  <p className="text-[11px] text-gray-400">{e.category}</p>
                </div>
                <span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">₹{Number(e.amount).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
