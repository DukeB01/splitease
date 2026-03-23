export interface Profile {
  id: string
  email: string
  full_name: string
  avatar_url?: string
  created_at: string
}

export interface Group {
  id: string
  name: string
  description?: string
  created_by: string
  created_at: string
  members?: GroupMember[]
}

export interface GroupMember {
  group_id: string
  user_id: string
  joined_at: string
  profile?: Profile
}

export interface GroupExpense {
  id: string
  group_id: string
  description: string
  amount: number
  paid_by: string
  split_type: 'equal' | 'custom'
  created_at: string
  splits?: ExpenseSplit[]
  payer?: Profile
}

export interface ExpenseSplit {
  id: string
  expense_id: string
  user_id: string
  amount: number
  profile?: Profile
}

export interface PersonalExpense {
  id: string
  user_id: string
  description: string
  amount: number
  category: string
  date: string
  created_at: string
}

export interface Income {
  id: string
  user_id: string
  description: string
  amount: number
  source: string
  date: string
  created_at: string
}

export const INCOME_SOURCES = [
  'Salary',
  'Freelance',
  'Investments',
  'Refund',
  'Gift',
  'Budget Allocation',
  'Other',
] as const

export type IncomeSource = (typeof INCOME_SOURCES)[number]

export interface Balance {
  from_user: string
  to_user: string
  amount: number
  from_profile?: Profile
  to_profile?: Profile
}

export const CATEGORIES = [
  'Food & Dining',
  'Rent & Housing',
  'Transport',
  'Shopping',
  'Entertainment',
  'Health',
  'Travel',
  'Utilities',
  'Education',
  'Other',
] as const

export type Category = (typeof CATEGORIES)[number]
