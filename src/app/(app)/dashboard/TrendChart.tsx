'use client'

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts'
import type { MonthlyTrendPoint } from '@/features/dashboard/aggregations'

function formatMonthLabel(month: string): string {
  return `${parseInt(month.split('-')[1], 10)}월`
}

function formatYAxis(value: number): string {
  if (value >= 10000000) return `${(value / 10000000).toFixed(0)}천만`
  if (value >= 1000000) return `${(value / 1000000).toFixed(0)}백만`
  if (value >= 10000) return `${(value / 10000).toFixed(0)}만`
  return String(value)
}

export default function TrendChart({ data }: { data: MonthlyTrendPoint[] }) {
  const hasData = data.some((d) => d.income > 0 || d.expense > 0)

  const chartData = data.map((d) => ({
    month: formatMonthLabel(d.month),
    수입: d.income,
    지출: d.expense,
  }))

  return (
    <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6">
      <h2 className="text-sm font-semibold text-gray-700 mb-6">월간 수입 / 지출 트렌드</h2>
      {!hasData ? (
        <div className="flex items-center justify-center h-[220px] text-sm text-gray-400">
          데이터가 없습니다
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} barGap={4} barCategoryGap="32%">
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 12, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={formatYAxis}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              width={52}
            />
            <Tooltip
              formatter={(value, name) => [
                `₩${Number(value).toLocaleString('ko-KR')}`,
                name,
              ]}
              contentStyle={{
                borderRadius: '12px',
                border: 'none',
                boxShadow: '0 8px 30px rgb(0,0,0,0.10)',
                fontSize: '13px',
                padding: '10px 14px',
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: '12px', paddingTop: '16px', color: '#6b7280' }}
            />
            <Bar dataKey="수입" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} />
            <Bar dataKey="지출" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
