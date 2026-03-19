'use client'

import { type StepProps, SECTORS } from '../../types'

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1 text-sm text-red-500">{message}</p>
}

function Step1({ answers, onUpdate }: StepProps) {
  const value = (answers.company_name as string) ?? ''
  const touched = answers._touched_company_name as boolean
  const error =
    touched && value.length < 2
      ? 'Minimum 2 caracteres'
      : touched && value.length > 80
        ? 'Maximum 80 caracteres'
        : undefined

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        Nom de l&apos;entreprise
      </label>
      <input
        type="text"
        value={value}
        maxLength={80}
        onBlur={() => onUpdate('_touched_company_name', true)}
        onChange={(e) => onUpdate('company_name', e.target.value)}
        placeholder="Ex: Boulangerie Dupont"
        className={`w-full rounded-lg border px-4 py-3 text-gray-900 outline-none transition-colors focus:ring-2 focus:ring-[#00D4B1]/40 ${
          error ? 'border-red-400 bg-red-50' : 'border-gray-300'
        }`}
      />
      <FieldError message={error} />
    </div>
  )
}

function Step2({ answers, onUpdate }: StepProps) {
  const selected = (answers.sector as string) ?? ''

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Secteur d&apos;activite
      </label>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {SECTORS.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => onUpdate('sector', s.value)}
            className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${
              selected === s.value
                ? 'border-[#00D4B1] bg-[#00D4B1]/5 shadow-sm'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <span className="text-2xl">{s.icon}</span>
            <span className="text-center text-sm font-medium text-gray-700">
              {s.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

function Step3({ answers, onUpdate }: StepProps) {
  const city = (answers.city as string) ?? ''
  const zip = (answers.zip as string) ?? ''
  const address = (answers.address as string) ?? ''
  const touched = answers._touched_location as boolean

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-gray-700">Localisation</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-gray-500">
            Ville *
          </label>
          <input
            type="text"
            value={city}
            onChange={(e) => onUpdate('city', e.target.value)}
            onBlur={() => onUpdate('_touched_location', true)}
            placeholder="Bruxelles"
            className={`w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-[#00D4B1]/40 ${
              touched && !city ? 'border-red-400 bg-red-50' : 'border-gray-300'
            }`}
          />
          {touched && !city && <FieldError message="Ville requise" />}
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">
            Code postal *
          </label>
          <input
            type="text"
            value={zip}
            onChange={(e) => onUpdate('zip', e.target.value)}
            onBlur={() => onUpdate('_touched_location', true)}
            placeholder="1000"
            className={`w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-[#00D4B1]/40 ${
              touched && !zip ? 'border-red-400 bg-red-50' : 'border-gray-300'
            }`}
          />
          {touched && !zip && <FieldError message="Code postal requis" />}
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs text-gray-500">
          Adresse (optionnel)
        </label>
        <input
          type="text"
          value={address}
          onChange={(e) => onUpdate('address', e.target.value)}
          placeholder="Rue de la Loi 1"
          className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-[#00D4B1]/40"
        />
      </div>
    </div>
  )
}

function Step4({ answers, onUpdate }: StepProps) {
  const phone = (answers.phone as string) ?? ''
  const email = (answers.contact_email as string) ?? ''
  const website = (answers.existing_website as string) ?? ''
  const touched = answers._touched_contact as boolean

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-gray-700">Contact</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-gray-500">
            Telephone *
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => onUpdate('phone', e.target.value)}
            onBlur={() => onUpdate('_touched_contact', true)}
            placeholder="+32 470 12 34 56"
            className={`w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-[#00D4B1]/40 ${
              touched && !phone ? 'border-red-400 bg-red-50' : 'border-gray-300'
            }`}
          />
          {touched && !phone && <FieldError message="Telephone requis" />}
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">
            Email *
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => onUpdate('contact_email', e.target.value)}
            onBlur={() => onUpdate('_touched_contact', true)}
            placeholder="contact@example.com"
            className={`w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-[#00D4B1]/40 ${
              touched && !email ? 'border-red-400 bg-red-50' : 'border-gray-300'
            }`}
          />
          {touched && !email && <FieldError message="Email requis" />}
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs text-gray-500">
          Site web actuel (optionnel)
        </label>
        <input
          type="url"
          value={website}
          onChange={(e) => onUpdate('existing_website', e.target.value)}
          placeholder="https://www.example.com"
          className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-[#00D4B1]/40"
        />
      </div>
    </div>
  )
}

function Step5({ answers, onUpdate }: StepProps) {
  const value = (answers.description as string) ?? ''
  const touched = answers._touched_description as boolean
  const len = value.length
  const error =
    touched && len < 50
      ? `Minimum 50 caracteres (${len}/50)`
      : touched && len > 800
        ? 'Maximum 800 caracteres'
        : undefined

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        Decrivez votre activite
      </label>
      <textarea
        value={value}
        maxLength={800}
        rows={5}
        onChange={(e) => onUpdate('description', e.target.value)}
        onBlur={() => onUpdate('_touched_description', true)}
        placeholder="Decrivez en quelques phrases votre activite, vos specialites, ce que vous proposez..."
        className={`w-full resize-none rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-[#00D4B1]/40 ${
          error ? 'border-red-400 bg-red-50' : 'border-gray-300'
        }`}
      />
      <div className="flex justify-between">
        <FieldError message={error} />
        <span
          className={`text-xs ${len > 750 ? 'text-orange-500' : 'text-gray-400'}`}
        >
          {len} / 800
        </span>
      </div>
    </div>
  )
}

export default function StepIdentity(props: StepProps) {
  switch (props.step) {
    case 1:
      return <Step1 {...props} />
    case 2:
      return <Step2 {...props} />
    case 3:
      return <Step3 {...props} />
    case 4:
      return <Step4 {...props} />
    case 5:
      return <Step5 {...props} />
    default:
      return null
  }
}
