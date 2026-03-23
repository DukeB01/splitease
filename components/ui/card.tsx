import { HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: boolean
}

export function Card({ children, padding = true, className = '', ...props }: CardProps) {
  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm ${padding ? 'p-5' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
