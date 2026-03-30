import { formatKRW } from '@/lib/format'
import type { MonthlyStats } from '@/features/dashboard/aggregations'

function StatCard({
  label,
  value,
  valueColor,
  subText,
}: {
  label: string
  value: string
  valueColor?: string
  subText?: string
}) {
  return (
    <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">{label}</p>
      <p className={`text-2xl font-semibold tabular-nums ${valueColor ?? 'text-gray-900'}`}>
        {value}
      </p>
      {subText && (
        <p className="text-xs text-gray-400 mt-2 tabular-nums">{subText}</p>
      )}
    </div>
  )
}

export default function StatsCards({
  totalAssets,
  stats,
}: {
  totalAssets: number
  stats: MonthlyStats
}) {
  const netPrefix = stats.netIncome >= 0 ? '+' : ''
  const netColor = stats.netIncome >= 0 ? 'text-emerald-600' : 'text-rose-600'

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label="총자산"
        value={formatKRW(totalAssets)}
      />
      <StatCard
        label="이번 달 수입"
        value={`+${formatKRW(stats.totalIncome)}`}
        valueColor="text-emerald-600"
      />
      <StatCard
        label="이번 달 지출"
        value={stats.totalExpense === 0 ? formatKRW(0) : `-${formatKRW(stats.totalExpense)}`}
        valueColor={stats.totalExpense === 0 ? undefined : 'text-rose-600'}
      />
      <StatCard
        label="순수입"
        value={`${netPrefix}${formatKRW(stats.netIncome)}`}
        valueColor={netColor}
        subText={`이체 ${formatKRW(stats.totalTransfer)}`}
      />
    </div>
  )
}
