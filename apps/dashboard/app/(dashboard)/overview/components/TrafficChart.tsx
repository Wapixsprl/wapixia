'use client'

import { useState, useCallback } from 'react'

interface DataPoint {
  date: string
  value: number
}

interface TrafficChartProps {
  data: DataPoint[]
}

export default function TrafficChart({ data }: TrafficChartProps) {
  const [tooltip, setTooltip] = useState<{
    x: number
    y: number
    date: string
    value: number
  } | null>(null)

  const width = 600
  const height = 200
  const paddingX = 40
  const paddingY = 30
  const chartWidth = width - paddingX * 2
  const chartHeight = height - paddingY * 2

  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-gray-200 bg-white text-sm text-gray-400">
        Aucune donn&eacute;e de trafic disponible
      </div>
    )
  }

  const values = data.map((d) => d.value)
  const maxValue = Math.max(...values, 1)
  const minValue = Math.min(...values, 0)
  const range = maxValue - minValue || 1

  const points = data.map((d, i) => ({
    x: paddingX + (i / (data.length - 1)) * chartWidth,
    y: paddingY + chartHeight - ((d.value - minValue) / range) * chartHeight,
    date: d.date,
    value: d.value,
  }))

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ')

  const areaPath = `${linePath} L ${points[points.length - 1].x} ${paddingY + chartHeight} L ${points[0].x} ${paddingY + chartHeight} Z`

  // Y-axis gridlines
  const gridLines = 4
  const gridValues = Array.from({ length: gridLines + 1 }, (_, i) =>
    Math.round(minValue + (range / gridLines) * i)
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = e.currentTarget
      const rect = svg.getBoundingClientRect()
      const mouseX = ((e.clientX - rect.left) / rect.width) * width

      let closest = points[0]
      let closestDist = Math.abs(mouseX - closest.x)

      for (const p of points) {
        const dist = Math.abs(mouseX - p.x)
        if (dist < closestDist) {
          closest = p
          closestDist = dist
        }
      }

      setTooltip({
        x: closest.x,
        y: closest.y,
        date: closest.date,
        value: closest.value,
      })
    },
    [points]
  )

  const handleMouseLeave = useCallback(() => {
    setTooltip(null)
  }, [])

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Grid lines */}
        {gridValues.map((val) => {
          const y =
            paddingY + chartHeight - ((val - minValue) / range) * chartHeight
          return (
            <g key={val}>
              <line
                x1={paddingX}
                y1={y}
                x2={width - paddingX}
                y2={y}
                stroke="#F3F4F6"
                strokeWidth={1}
              />
              <text
                x={paddingX - 8}
                y={y + 4}
                textAnchor="end"
                fill="#9CA3AF"
                fontSize="10"
              >
                {val}
              </text>
            </g>
          )
        })}

        {/* Gradient fill */}
        <defs>
          <linearGradient id="trafficGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00D4B1" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#00D4B1" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        <path d={areaPath} fill="url(#trafficGradient)" />

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke="#00D4B1"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Tooltip elements */}
        {tooltip !== null && (
          <>
            <line
              x1={tooltip.x}
              y1={paddingY}
              x2={tooltip.x}
              y2={paddingY + chartHeight}
              stroke="#00D4B1"
              strokeWidth={1}
              strokeDasharray="4 2"
              opacity={0.5}
            />
            <circle
              cx={tooltip.x}
              cy={tooltip.y}
              r={5}
              fill="#00D4B1"
              stroke="white"
              strokeWidth={2}
            />
          </>
        )}
      </svg>

      {/* Floating tooltip */}
      {tooltip !== null && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg"
          style={{
            left: `${(tooltip.x / width) * 100}%`,
            top: `${(tooltip.y / height) * 100 - 15}%`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <p className="font-medium text-gray-900">{tooltip.value} visites</p>
          <p className="text-gray-500">{tooltip.date}</p>
        </div>
      )}
    </div>
  )
}
