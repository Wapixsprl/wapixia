'use client'

import { useEffect, useState } from 'react'

interface PillarScore {
  label: string
  score: number
}

interface VisibilityGaugeProps {
  score: number
  pillars: PillarScore[]
}

function getScoreColor(score: number): string {
  if (score >= 70) return '#00D4B1'
  if (score >= 40) return '#F59E0B'
  return '#EF4444'
}

export default function VisibilityGauge({ score, pillars }: VisibilityGaugeProps) {
  const [animatedScore, setAnimatedScore] = useState(0)

  useEffect(() => {
    const timeout = setTimeout(() => {
      setAnimatedScore(score)
    }, 100)
    return () => clearTimeout(timeout)
  }, [score])

  const radius = 70
  const strokeWidth = 12
  const circumference = 2 * Math.PI * radius
  const halfCircumference = circumference / 2
  const offset = halfCircumference - (animatedScore / 100) * halfCircumference
  const color = getScoreColor(score)

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Circular Gauge */}
      <div className="relative">
        <svg
          width="200"
          height="120"
          viewBox="0 0 200 120"
          className="overflow-visible"
        >
          {/* Background arc */}
          <path
            d="M 20 100 A 70 70 0 0 1 180 100"
            fill="none"
            stroke="#E5E7EB"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          {/* Foreground arc */}
          <path
            d="M 20 100 A 70 70 0 0 1 180 100"
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={halfCircumference}
            strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out"
          />
          {/* Score text */}
          <text
            x="100"
            y="85"
            textAnchor="middle"
            className="text-3xl font-bold"
            fill={color}
            fontSize="36"
          >
            {score}
          </text>
          <text
            x="100"
            y="108"
            textAnchor="middle"
            className="text-xs"
            fill="#6B7280"
            fontSize="12"
          >
            / 100
          </text>
        </svg>
      </div>

      {/* Pillar bars */}
      <div className="grid w-full grid-cols-5 gap-3">
        {pillars.map((pillar) => {
          const pillarColor = getScoreColor(pillar.score)
          return (
            <div key={pillar.label} className="flex flex-col items-center gap-1">
              <div className="h-20 w-full rounded-md bg-gray-100 relative overflow-hidden">
                <div
                  className="absolute bottom-0 w-full rounded-md transition-all duration-700 ease-out"
                  style={{
                    height: `${pillar.score}%`,
                    backgroundColor: pillarColor,
                  }}
                />
              </div>
              <span className="text-[10px] font-medium text-gray-500 text-center leading-tight">
                {pillar.label}
              </span>
              <span
                className="text-xs font-bold"
                style={{ color: pillarColor }}
              >
                {pillar.score}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
