'use client'

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Tooltip,
  Legend,
} from 'recharts'
import { formatKRW } from '@/lib/format'
import type { CategoryExpense } from '@/features/dashboard/aggregations'

// 9색 팔레트 (인덱스 기반 하드코딩, Phase 6에서 카테고리 color 컬럼 연결 예정)
const PALETTE = [
  '#6366f1', // indigo-500
  '#f43f5e', // rose-500
  '#f59e0b', // amber-500
  '#10b981', // emerald-500
  '#8b5cf6', // violet-500
  '#0ea5e9', // sky-500
  '#f97316', // orange-500
  '#14b8a6', // teal-500
  '#ec4899', // pink-500
]

type ChartEntry = { name: string; amount: number; percentage: number; fill: string }

export default function CategoryChart({ data }: { data: CategoryExpense[] }) {
  const chartData: ChartEntry[] = data.map((d, i) => ({
    name: d.categoryName,
    amount: d.amount,
    percentage: d.percentage,
    fill: PALETTE[i % PALETTE.length],
  }))

  return (
    <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">지출 카테고리</h2>
      {chartData.length === 0 ? (
        <div className="flex items-center justify-center h-[240px] text-sm text-gray-400">
          이번 달 지출 내역이 없습니다
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="amount"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={58}
              outerRadius={88}
              paddingAngle={2}
            />
            <Tooltip
              formatter={(value, name, item) => {
                const entry = item.payload as ChartEntry
                return [`${formatKRW(Number(value))} (${entry?.percentage ?? 0}%)`, name]
              }}
              contentStyle={{
                borderRadius: '12px',
                border: 'none',
                boxShadow: '0 8px 30px rgb(0,0,0,0.10)',
                fontSize: '13px',
                padding: '10px 14px',
              }}
            />
            <Legend
              formatter={(value: string, entry) => {
                const payload = entry.payload as ChartEntry | undefined
                return (
                  <span style={{ color: '#4b5563', fontSize: '12px' }}>
                    {value} {formatKRW(payload?.amount ?? 0)}
                  </span>
                )
              }}
              wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
