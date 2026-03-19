'use client'

import {
  type StepProps,
  DAYS,
  PAYMENT_METHODS,
  BOOLEAN_OPTIONS,
  RADIUS_OPTIONS,
} from '../../types'

interface DaySchedule {
  open: boolean
  start: string
  end: string
}

function Step10({ answers, onUpdate }: StepProps) {
  const hours = (answers.hours as Record<string, DaySchedule>) ?? {}

  function getDay(day: string): DaySchedule {
    return hours[day] ?? { open: true, start: '09:00', end: '18:00' }
  }

  function updateDay(day: string, field: keyof DaySchedule, value: string | boolean) {
    const current = getDay(day)
    onUpdate('hours', {
      ...hours,
      [day]: { ...current, [field]: value },
    })
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Horaires d&apos;ouverture
      </label>
      <div className="space-y-2">
        {DAYS.map((day) => {
          const d = getDay(day)
          return (
            <div
              key={day}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 p-3"
            >
              <span className="w-24 text-sm font-medium text-gray-700">
                {day}
              </span>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={d.open}
                  onChange={(e) => updateDay(day, 'open', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-[#00D4B1] accent-[#00D4B1]"
                />
                <span className="text-xs text-gray-500">Ouvert</span>
              </label>
              {d.open && (
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={d.start}
                    onChange={(e) => updateDay(day, 'start', e.target.value)}
                    className="rounded border border-gray-300 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-[#00D4B1]/40"
                  />
                  <span className="text-gray-400">-</span>
                  <input
                    type="time"
                    value={d.end}
                    onChange={(e) => updateDay(day, 'end', e.target.value)}
                    className="rounded border border-gray-300 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-[#00D4B1]/40"
                  />
                </div>
              )}
              {!d.open && (
                <span className="text-xs italic text-gray-400">Ferme</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Step11({ answers, onUpdate }: StepProps) {
  const selected = (answers.payment_methods as string[]) ?? []

  function toggle(value: string) {
    if (selected.includes(value)) {
      onUpdate('payment_methods', selected.filter((v) => v !== value))
    } else {
      onUpdate('payment_methods', [...selected, value])
    }
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Moyens de paiement acceptes
      </label>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {PAYMENT_METHODS.map((pm) => (
          <label
            key={pm.value}
            className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 p-3 transition-all ${
              selected.includes(pm.value)
                ? 'border-[#00D4B1] bg-[#00D4B1]/5'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <input
              type="checkbox"
              checked={selected.includes(pm.value)}
              onChange={() => toggle(pm.value)}
              className="h-4 w-4 rounded border-gray-300 accent-[#00D4B1]"
            />
            <span className="text-sm text-gray-700">{pm.label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

function Step12({ answers, onUpdate }: StepProps) {
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Options pratiques
      </label>
      <div className="space-y-2">
        {BOOLEAN_OPTIONS.map((opt) => {
          const checked = (answers[opt.key] as boolean) ?? false
          return (
            <label
              key={opt.key}
              className="flex cursor-pointer items-center justify-between rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50"
            >
              <span className="text-sm font-medium text-gray-700">
                {opt.label}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={checked}
                onClick={() => onUpdate(opt.key, !checked)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
                  checked ? 'bg-[#00D4B1]' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow-sm transition-transform ${
                    checked ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </label>
          )
        })}
      </div>
    </div>
  )
}

function Step13({ answers, onUpdate }: StepProps) {
  const radius = (answers.radius as string) ?? ''
  const cities = (answers.main_cities as string) ?? ''

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Rayon d&apos;action
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {RADIUS_OPTIONS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => onUpdate('radius', r.value)}
              className={`rounded-lg border-2 px-3 py-2 text-sm transition-all ${
                radius === r.value
                  ? 'border-[#00D4B1] bg-[#00D4B1]/5 font-medium'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Villes principales desservies
        </label>
        <input
          type="text"
          value={cities}
          onChange={(e) => onUpdate('main_cities', e.target.value)}
          placeholder="Bruxelles, Namur, Liege..."
          className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-[#00D4B1]/40"
        />
      </div>
    </div>
  )
}

export default function StepPractical(props: StepProps) {
  switch (props.step) {
    case 10:
      return <Step10 {...props} />
    case 11:
      return <Step11 {...props} />
    case 12:
      return <Step12 {...props} />
    case 13:
      return <Step13 {...props} />
    default:
      return null
  }
}
