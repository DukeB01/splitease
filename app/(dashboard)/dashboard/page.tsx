'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useUser } from '@/lib/hooks'
import { Card } from '@/components/ui/card'
import { PersonalExpense, GroupExpense, Income } from '@/lib/types'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import Link from 'next/link'

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16']
const CATEGORY_EMOJI: Record<string, string> = {
  'Food & Dining': '🍕', 'Rent & Housing': '🏠', 'Transport': '🚗', 'Shopping': '🛒',
  'Entertainment': '🎬', 'Health': '💊', 'Travel': '✈️', 'Utilities': '💡', 'Education': '📚', 'Other': '📌',
}

type DateFilter = 'this_month' | 'last_month' | 'custom'

function getDateRange(filter: DateFilter, customFrom: string, customTo: string): { from: string; to: string } {
  const now = new Date()
  if (filter === 'this_month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1)
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return { from: fmt(from), to: fmt(to) }
  }
  if (filter === 'last_month') {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const to = new Date(now.getFullYear(), now.getMonth(), 0)
    return { from: fmt(from), to: fmt(to) }
  }
  return { from: customFrom, to: customTo }
}

function fmt(d: Date) {
  return d.toISOString().split('T')[0]
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

  // Date filter
  const [dateFilter, setDateFilter] = useState<DateFilter>('this_month')
  const [customFrom, setCustomFrom] = useState(fmt(new Date()))
  const [customTo, setCustomTo] = useState(fmt(new Date()))

  const { from, to } = getDateRange(dateFilter, customFrom, customTo)

  useEffect(() => {
    if (!user) return
    const load = async () => {
      setLoading(true)
      // All personal expenses (for filtering client-side)
      const { data: pe } = await supabase
        .from('personal_expenses')
        .select('*')
        .order('date', { ascending: false })

      setAllExpenses(pe || [])

      // Income
      const { data: inc } = await supabase
        .from('income')
        .select('*')
        .order('date', { ascending: false })
      setAllIncome(inc || [])

      // Groups
      const { data: gm } = await supabase
        .from('group_members')
        .select('group_id, groups(id, name)')
        .eq('user_id', user.id)

      const grps = (gm || []).map((m: any) => m.groups).filter(Boolean)
      setGroups(grps)

      // Calculate balances across all groups
      let owe = 0, owed = 0
      for (const g of grps) {
        const { data: expenses } = await supabase
          .from('group_expenses')
          .select('*, splits:expense_splits(*)')
          .eq('group_id', g.id)

        for (const exp of (expenses || []) as (GroupExpense & { splits: { user_id: string; amount: number }[] })[]) {
          if (exp.paid_by === user.id) {
            const othersTotal = exp.splits
              .filter(s => s.user_id !== user.id)
              .reduce((sum, s) => sum + Number(s.amount), 0)
            owed += othersTotal
          } else {
            const mySplit = exp.splits.find(s => s.user_id === user.id)
            if (mySplit) owe += Number(mySplit.amount)
          }
        }
      }
      setYouOwe(owe)
      setYouAreOwed(owed)
      setLoading(false)
    }
    load()
  }, [user])

  // Filtered expenses based on date range
  const filteredExpenses = useMemo(() =>
    allExpenses.filter(e => e.date >= from && e.date <= to),
    [allExpenses, from, to]
  )

  // Filtered income based on date range
  const filteredIncome = useMemo(() =>
    allIncome.filter(e => e.date >= from && e.date <= to),
    [allIncome, from, to]
  )

  const totalExpense = filteredExpenses.reduce((s, e) => s + Number(e.amount), 0)
  const totalIncome = filteredIncome.reduce((s, e) => s + Number(e.amount), 0)
  const netBalance = youAreOwed - youOwe
  const savings = totalIncome - totalExpense

  // Pie chart data
  const categoryTotals = filteredExpenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + Number(e.amount)
    return acc
  }, {} as Record<string, number>)

  const pieData = Object.entries(categoryTotals)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  // Bar chart — daily spending
  const dailyTotals = filteredExpenses.reduce((acc, e) => {
    const d = new Date(e.date)
    const label = `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`
    acc[label] = (acc[label] || 0) + Number(e.amount)
    return acc
  }, {} as Record<string, number>)

  const barData = Object.entries(dailyTotals)
    .map(([day, amount]) => ({ day, amount }))
    .slice(-15) // Last 15 days

  const filterLabel = dateFilter === 'this_month' ? 'This Month' : dateFilter === 'last_month' ? 'Last Month' : `${from} to ${to}`

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Your financial overview</p>
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-2 flex-wrap">
          {(['this_month', 'last_month', 'custom'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setDateFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${dateFilter === f ? 'bg-emerald-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
            >
              {f === 'this_month' ? 'This Month' : f === 'last_month' ? 'Last Month' : 'Custom'}
            </button>
          ))}
        </div>
      </div>

      {/* Custom date picker */}
      {dateFilter === 'custom' && (
        <Card className="!py-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">From</label>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">To</label>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Income</p>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-emerald-600">₹{totalIncome.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">{filteredIncome.length} entries · {filterLabel}</p>
        </Card>

        <Card className="border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
              </svg>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Expense</p>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-red-500">₹{totalExpense.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">{filteredExpenses.length} transactions</p>
        </Card>

        <Card className={`${savings >= 0 ? 'border-emerald-200 dark:border-emerald-800' : 'border-red-200 dark:border-red-800'}`}>
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${savings >= 0 ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
              <svg className={`w-4 h-4 ${savings >= 0 ? 'text-emerald-600' : 'text-red-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
              </svg>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Savings</p>
          </div>
          <p className={`text-xl sm:text-2xl font-bold ${savings >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {savings < 0 ? '-' : ''}₹{Math.abs(savings).toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mt-1">{savings >= 0 ? 'Under budget' : 'Over budget'}</p>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">You Owe</p>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-orange-500">₹{youOwe.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">To others</p>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid sm:grid-cols-2 gap-4">
        {/* Bar Chart — Daily Spending */}
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Daily Spending</h3>
          <p className="text-xs text-gray-400 mb-4">{filterLabel}</p>
          {barData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-sm text-gray-400">No data for this period</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.4} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  interval={barData.length > 10 ? 1 : 0}
                  angle={-45}
                  textAnchor="end"
                  height={50}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `₹${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: '12px' }}
                  formatter={(v) => [`₹${Number(v).toLocaleString()}`, 'Spent']}
                  cursor={{ fill: 'rgba(16, 185, 129, 0.1)' }}
                />
                <Bar dataKey="amount" fill="url(#barGrad)" radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Pie Chart — Category Breakdown */}
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Category Breakdown</h3>
          <p className="text-xs text-gray-400 mb-4">{filterLabel}</p>
          {pieData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-sm text-gray-400">No data for this period</div>
          ) : (
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: '12px' }}
                    formatter={(v) => [`₹${Number(v).toLocaleString()}`, 'Amount']}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Custom legend */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-2 w-full">
                {pieData.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-xs text-gray-600 dark:text-gray-400 truncate">
                      {CATEGORY_EMOJI[item.name] || ''} {item.name}
                    </span>
                    <span className="text-xs font-medium text-gray-800 dark:text-gray-200 ml-auto">
                      ₹{item.value.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Groups */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Your Groups</h3>
          <Link href="/groups" className="text-xs text-emerald-600 hover:underline">View all</Link>
        </div>
        {groups.length === 0 ? (
          <p className="text-sm text-gray-400">No groups yet. <Link href="/groups" className="text-emerald-600 hover:underline">Create one</Link></p>
        ) : (
          <div className="space-y-2">
            {groups.slice(0, 5).map((g) => (
              <Link key={g.id} href={`/groups/${g.id}`} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 font-semibold text-sm">
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
          <div className="space-y-2">
            {filteredExpenses.slice(0, 5).map((e) => (
              <div key={e.id} className="flex items-center gap-3 py-2">
                <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-base">
                  {CATEGORY_EMOJI[e.category] || '📌'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{e.description}</p>
                  <p className="text-xs text-gray-400">{e.category} · {new Date(e.date).toLocaleDateString()}</p>
                </div>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">₹{Number(e.amount).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
