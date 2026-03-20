'use client'

interface KPICardProps {
  icon: React.ReactNode
  label: string
  value: string | number | null
  delta: number | null
}

export default function KPICard({ icon, label, value, delta }: KPICardProps) {
  const formattedValue = value ?? '\u2013'

  let deltaDisplay: React.ReactNode
  if (delta === null || delta === undefined) {
    deltaDisplay = (
      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
        &ndash;
      </span>
    )
  } else if (delta >= 0) {
    deltaDisplay = (
      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
        &uarr; {delta > 0 ? '+' : ''}{delta}%
      </span>
    )
  } else {
    deltaDisplay = (
      <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
        &darr; {delta}%
      </span>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#00D4B1]/10 text-[#00D4B1]">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-500 truncate">{label}</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-gray-900">{formattedValue}</p>
            {deltaDisplay}
          </div>
        </div>
      </div>
    </div>
  )
}
