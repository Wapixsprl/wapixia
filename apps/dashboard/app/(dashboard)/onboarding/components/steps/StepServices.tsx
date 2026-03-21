'use client'

import { type StepProps, PRICE_RANGES } from '../../types'

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1 text-sm text-red-500">{message}</p>
}

function Step6({ answers, onUpdate }: StepProps) {
  const items = (answers.services as string[]) ?? ['', '']
  const touched = answers._touched_services as boolean

  function updateItem(index: number, value: string) {
    const next = [...items]
    next[index] = value
    onUpdate('services', next)
  }

  function addItem() {
    if (items.length >= 8) return
    onUpdate('services', [...items, ''])
  }

  function removeItem(index: number) {
    if (items.length <= 2) return
    onUpdate('services', items.filter((_, i) => i !== index))
  }

  const filledCount = items.filter((s) => s.trim().length > 0).length
  const error = touched && filledCount < 2 ? 'Ajoutez au moins 2 prestations' : undefined

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Vos prestations / services
      </label>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="text"
              value={item}
              onChange={(e) => updateItem(i, e.target.value)}
              onBlur={() => onUpdate('_touched_services', true)}
              placeholder={`Prestation ${i + 1}`}
              className={`flex-1 rounded-lg border px-4 py-2.5 outline-none focus:ring-2 focus:ring-[#F5A623]/40 ${
                error && !item.trim() ? 'border-red-400 bg-red-50' : 'border-gray-300'
              }`}
            />
            {items.length > 2 && (
              <button
                type="button"
                onClick={() => removeItem(i)}
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                aria-label="Supprimer"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>
      <FieldError message={error} />
      {items.length < 8 && (
        <button
          type="button"
          onClick={addItem}
          className="rounded-lg border-2 border-dashed border-gray-300 px-4 py-2 text-sm text-gray-500 transition-colors hover:border-[#F5A623] hover:text-[#F5A623]"
        >
          + Ajouter une prestation
        </button>
      )}
      <p className="text-xs text-gray-400">{items.length}/8 prestations</p>
    </div>
  )
}

function Step7({ answers, onUpdate }: StepProps) {
  const selected = (answers.price_range as string) ?? ''

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Gamme de prix
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        {PRICE_RANGES.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => onUpdate('price_range', p.value)}
            className={`rounded-xl border-2 px-4 py-3 text-left transition-all ${
              selected === p.value
                ? 'border-[#F5A623] bg-[#F5A623]/5'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <span className="text-sm font-medium text-gray-700">{p.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function Step8({ answers, onUpdate }: StepProps) {
  const value = (answers.differentiator as string) ?? ''
  const touched = answers._touched_differentiator as boolean
  const len = value.length
  const error =
    touched && len < 30
      ? `Minimum 30 caracteres (${len}/30)`
      : touched && len > 300
        ? 'Maximum 300 caracteres'
        : undefined

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        Ce qui vous differencie
      </label>
      <textarea
        value={value}
        maxLength={300}
        rows={4}
        onChange={(e) => onUpdate('differentiator', e.target.value)}
        onBlur={() => onUpdate('_touched_differentiator', true)}
        placeholder="Qu'est-ce qui rend votre entreprise unique ? Pourquoi les clients vous choisissent ?"
        className={`w-full resize-none rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-[#F5A623]/40 ${
          error ? 'border-red-400 bg-red-50' : 'border-gray-300'
        }`}
      />
      <div className="flex justify-between">
        <FieldError message={error} />
        <span className={`text-xs ${len > 270 ? 'text-orange-500' : 'text-gray-400'}`}>
          {len} / 300
        </span>
      </div>
    </div>
  )
}

function Step9({ answers, onUpdate }: StepProps) {
  const value = (answers.target_audience as string) ?? ''
  const touched = answers._touched_target as boolean
  const len = value.length
  const error =
    touched && len < 20
      ? `Minimum 20 caracteres (${len}/20)`
      : touched && len > 300
        ? 'Maximum 300 caracteres'
        : undefined

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        Clientele cible
      </label>
      <textarea
        value={value}
        maxLength={300}
        rows={4}
        onChange={(e) => onUpdate('target_audience', e.target.value)}
        onBlur={() => onUpdate('_touched_target', true)}
        placeholder="Decrivez votre clientele ideale : age, profil, besoins..."
        className={`w-full resize-none rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-[#F5A623]/40 ${
          error ? 'border-red-400 bg-red-50' : 'border-gray-300'
        }`}
      />
      <div className="flex justify-between">
        <FieldError message={error} />
        <span className={`text-xs ${len > 270 ? 'text-orange-500' : 'text-gray-400'}`}>
          {len} / 300
        </span>
      </div>
    </div>
  )
}

export default function StepServices(props: StepProps) {
  switch (props.step) {
    case 6:
      return <Step6 {...props} />
    case 7:
      return <Step7 {...props} />
    case 8:
      return <Step8 {...props} />
    case 9:
      return <Step9 {...props} />
    default:
      return null
  }
}
