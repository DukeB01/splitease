'use client'

import { Card } from '@/components/ui/card'
import { PersonalExpense } from '@/lib/types'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16']
const CATEGORY_EMOJI: Record<string, string> = {
  'Food & Dining': '🍕', 'Rent & Housing': '🏠', 'Transport': '🚗', 'Shopping': '🛒',
  'Entertainment': '🎬', 'Health': '💊', 'Travel': '✈️', 'Utilities': '💡', 'Education': '📚', 'Other': '📌',
}

interface Props {
  filteredExpenses: PersonalExpense[]
  filterLabel: string
}

export default function DashboardCharts({ filteredExpenses, filterLabel }: Props) {
  const categoryTotals = filteredExpenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + Number(e.amount)
    return acc
  }, {} as Record<string, number>)

  const pieData = Object.entries(categoryTotals)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  const dailyTotals = filteredExpenses.reduce((acc, e) => {
    const d = new Date(e.date)
    const label = `${d.getDate()}/${d.getMonth() + 1}`
    acc[label] = (acc[label] || 0) + Number(e.amount)
    return acc
  }, {} as Record<string, number>)

  const barData = Object.entries(dailyTotals)
    .map(([day, amount]) => ({ day, amount }))
    .slice(-15)

  if (barData.length === 0 && pieData.length === 0) return null

  return (
    <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
      {barData.length > 0 && (
        <Card className="!p-3 sm:!p-5">
          <h3 className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-0.5">Daily Spending</h3>
          <p className="text-[10px] sm:text-xs text-gray-400 mb-3">{filterLabel}</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={barData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.3} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} interval={barData.length > 8 ? 1 : 0} />
              <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : `${v}`} />
              <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '11px', padding: '6px 10px' }}
                formatter={(v) => [`₹${Number(v).toLocaleString()}`, 'Spent']} cursor={{ fill: 'rgba(16,185,129,0.08)' }} />
              <Bar dataKey="amount" fill="url(#barGrad)" radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {pieData.length > 0 && (
        <Card className="!p-3 sm:!p-5">
          <h3 className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-0.5">By Category</h3>
          <p className="text-[10px] sm:text-xs text-gray-400 mb-3">{filterLabel}</p>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={2} strokeWidth={0}>
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '11px', padding: '6px 10px' }}
                formatter={(v) => [`₹${Number(v).toLocaleString()}`, 'Amount']} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-1">
            {pieData.slice(0, 6).map((item, i) => (
              <div key={item.name} className="flex items-center gap-1.5 min-w-0">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 truncate">{CATEGORY_EMOJI[item.name] || ''} {item.name}</span>
                <span className="text-[10px] sm:text-xs font-medium text-gray-700 dark:text-gray-300 ml-auto tabular-nums">₹{item.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
