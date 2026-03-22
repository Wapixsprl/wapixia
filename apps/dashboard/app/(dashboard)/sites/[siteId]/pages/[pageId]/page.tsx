'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createBrowserClient } from '../../../../../../lib/supabase'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SectionType =
  | 'hero'
  | 'text'
  | 'image'
  | 'gallery'
  | 'cta'
  | 'testimonials'
  | 'pricing'
  | 'contact'
  | 'map'
  | 'faq'
  | 'video'
  | 'features'

interface SectionSettings {
  fullWidth: boolean
  background: string
  padding: 'sm' | 'md' | 'lg' | 'xl'
}

interface Section {
  id: string
  type: SectionType
  content: Record<string, unknown>
  settings: SectionSettings
}

interface PageData {
  id: string
  title: string
  slug: string
  sections: Section[]
}

interface ToastState {
  message: string
  type: 'success' | 'error'
  visible: boolean
}

// ---------------------------------------------------------------------------
// Section type metadata & defaults
// ---------------------------------------------------------------------------

const SECTION_TYPES: { type: SectionType; label: string }[] = [
  { type: 'hero', label: 'Hero' },
  { type: 'text', label: 'Texte' },
  { type: 'image', label: 'Image' },
  { type: 'gallery', label: 'Galerie' },
  { type: 'cta', label: 'CTA' },
  { type: 'testimonials', label: 'Temoignages' },
  { type: 'pricing', label: 'Tarifs' },
  { type: 'contact', label: 'Contact' },
  { type: 'map', label: 'Carte' },
  { type: 'faq', label: 'FAQ' },
  { type: 'video', label: 'Video' },
  { type: 'features', label: 'Features' },
]

function getDefaultContent(type: SectionType): Record<string, unknown> {
  switch (type) {
    case 'hero':
      return {
        title: 'Titre principal',
        subtitle: 'Sous-titre',
        cta_text: 'En savoir plus',
        cta_url: '#',
        background_image: '',
      }
    case 'text':
      return { title: 'Titre de section', body: 'Votre texte ici...' }
    case 'image':
      return { url: '', alt: '', caption: '' }
    case 'gallery':
      return {
        items: [{ title: 'Image 1', url: '', description: '' }],
      }
    case 'cta':
      return {
        title: 'Pret a commencer ?',
        subtitle: 'Contactez-nous',
        button_text: 'Contact',
        button_url: '/contact',
      }
    case 'testimonials':
      return {
        items: [{ name: 'Client', text: 'Excellent service !', rating: 5 }],
      }
    case 'pricing':
      return {
        items: [
          {
            name: 'Basique',
            price: '29',
            period: '/mois',
            features: ['Feature 1', 'Feature 2'],
            highlighted: false,
          },
        ],
      }
    case 'contact':
      return { title: 'Contactez-nous', email: '', phone: '', address: '' }
    case 'map':
      return { address: '', zoom: 15 }
    case 'faq':
      return { items: [{ question: 'Question ?', answer: 'Reponse...' }] }
    case 'video':
      return { url: '', title: '' }
    case 'features':
      return {
        items: [
          { icon: 'star', title: 'Feature', description: 'Description' },
        ],
      }
  }
}

const defaultSettings: SectionSettings = {
  fullWidth: false,
  background: '#ffffff',
  padding: 'md',
}

// ---------------------------------------------------------------------------
// Icons (inline SVGs)
// ---------------------------------------------------------------------------

function SectionIcon({ type, size = 24 }: { type: SectionType; size?: number }) {
  const s = size
  const common = { width: s, height: s, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

  switch (type) {
    case 'hero':
      return (<svg {...common}><rect x="2" y="3" width="20" height="18" rx="2"/><line x1="6" y1="10" x2="18" y2="10"/><line x1="9" y1="14" x2="15" y2="14"/><rect x="9" y="17" width="6" height="2" rx="1"/></svg>)
    case 'text':
      return (<svg {...common}><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="10" x2="20" y2="10"/><line x1="4" y1="14" x2="16" y2="14"/><line x1="4" y1="18" x2="12" y2="18"/></svg>)
    case 'image':
      return (<svg {...common}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>)
    case 'gallery':
      return (<svg {...common}><rect x="2" y="2" width="8" height="8" rx="1"/><rect x="14" y="2" width="8" height="8" rx="1"/><rect x="2" y="14" width="8" height="8" rx="1"/><rect x="14" y="14" width="8" height="8" rx="1"/></svg>)
    case 'cta':
      return (<svg {...common}><rect x="2" y="6" width="20" height="12" rx="2"/><line x1="7" y1="10" x2="17" y2="10"/><rect x="8" y="13" width="8" height="3" rx="1.5"/></svg>)
    case 'testimonials':
      return (<svg {...common}><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>)
    case 'pricing':
      return (<svg {...common}><rect x="2" y="4" width="6" height="16" rx="1"/><rect x="9" y="2" width="6" height="18" rx="1"/><rect x="16" y="4" width="6" height="16" rx="1"/></svg>)
    case 'contact':
      return (<svg {...common}><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 7L2 7"/></svg>)
    case 'map':
      return (<svg {...common}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>)
    case 'faq':
      return (<svg {...common}><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>)
    case 'video':
      return (<svg {...common}><rect x="2" y="4" width="20" height="16" rx="2"/><polygon points="10,8 16,12 10,16" fill="currentColor" stroke="none"/></svg>)
    case 'features':
      return (<svg {...common}><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" /></svg>)
  }
}

// drag handle icon
function DragIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="5" cy="3" r="1.2"/><circle cx="11" cy="3" r="1.2"/>
      <circle cx="5" cy="8" r="1.2"/><circle cx="11" cy="8" r="1.2"/>
      <circle cx="5" cy="13" r="1.2"/><circle cx="11" cy="13" r="1.2"/>
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Section Preview Rendering
// ---------------------------------------------------------------------------

function SectionPreview({ section }: { section: Section }) {
  const { type, content, settings } = section
  const pad = settings.padding === 'sm' ? 'p-3' : settings.padding === 'lg' ? 'p-8' : settings.padding === 'xl' ? 'p-12' : 'p-5'

  switch (type) {
    case 'hero': {
      const bg = (content.background_image as string)
        ? `url(${content.background_image as string})`
        : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      return (
        <div className={`${pad} rounded-lg text-center text-white min-h-[180px] flex flex-col items-center justify-center`} style={{ background: bg }}>
          <h2 className="text-2xl font-bold mb-2">{(content.title as string) || 'Titre principal'}</h2>
          <p className="text-base opacity-90 mb-4">{(content.subtitle as string) || 'Sous-titre'}</p>
          <span className="inline-block bg-white text-gray-900 px-5 py-2 rounded-full text-sm font-semibold">{(content.cta_text as string) || 'En savoir plus'}</span>
        </div>
      )
    }

    case 'text':
      return (
        <div className={pad}>
          <h3 className="text-lg font-bold mb-2">{(content.title as string) || 'Titre'}</h3>
          <p className="text-gray-600 text-sm leading-relaxed">{(content.body as string) || 'Votre texte ici...'}</p>
        </div>
      )

    case 'image': {
      const url = content.url as string
      return (
        <div className={pad}>
          {url ? (
            <img src={url} alt={(content.alt as string) || ''} className="w-full h-40 object-cover rounded-lg" />
          ) : (
            <div className="w-full h-40 bg-gray-100 rounded-lg flex flex-col items-center justify-center text-gray-400">
              <SectionIcon type="image" size={32} />
              <span className="text-xs mt-1">Image</span>
            </div>
          )}
          {(content.caption as string) && <p className="text-xs text-gray-500 mt-1 text-center">{content.caption as string}</p>}
        </div>
      )
    }

    case 'gallery': {
      const items = (content.items as Array<{ title: string; url: string; description: string }>) || []
      return (
        <div className={`${pad}`}>
          <div className="grid grid-cols-3 gap-2">
            {items.map((it, i) => (
              <div key={i} className="bg-gray-100 rounded-lg h-24 flex items-center justify-center text-gray-400 text-xs overflow-hidden">
                {it.url ? <img src={it.url} alt={it.title} className="w-full h-full object-cover" /> : <SectionIcon type="image" size={20} />}
              </div>
            ))}
          </div>
        </div>
      )
    }

    case 'cta':
      return (
        <div className={`${pad} rounded-lg text-center`} style={{ background: 'linear-gradient(135deg, #f5a623 0%, #f7c948 100%)' }}>
          <h3 className="text-xl font-bold text-white mb-1">{(content.title as string) || 'Pret a commencer ?'}</h3>
          <p className="text-white/80 text-sm mb-3">{(content.subtitle as string) || 'Contactez-nous'}</p>
          <span className="inline-block bg-white text-gray-900 px-5 py-2 rounded-full text-sm font-semibold">{(content.button_text as string) || 'Contact'}</span>
        </div>
      )

    case 'testimonials': {
      const items = (content.items as Array<{ name: string; text: string; rating: number }>) || []
      return (
        <div className={`${pad} space-y-3`}>
          {items.map((it, i) => (
            <div key={i} className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-1 mb-2">
                {Array.from({ length: it.rating || 5 }).map((_, si) => (
                  <svg key={si} width="14" height="14" viewBox="0 0 24 24" fill="#F5A623" stroke="none"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>
                ))}
              </div>
              <p className="text-sm text-gray-700 italic mb-2">&ldquo;{it.text}&rdquo;</p>
              <p className="text-xs font-semibold text-gray-900">{it.name}</p>
            </div>
          ))}
        </div>
      )
    }

    case 'pricing': {
      const items = (content.items as Array<{ name: string; price: string; period: string; features: string[]; highlighted: boolean }>) || []
      return (
        <div className={`${pad} flex gap-3 overflow-x-auto`}>
          {items.map((it, i) => (
            <div key={i} className={`flex-1 min-w-[140px] rounded-lg border p-4 text-center ${it.highlighted ? 'border-[#F5A623] ring-2 ring-[#F5A623]/30' : 'border-gray-200'}`}>
              <p className="font-semibold text-sm mb-1">{it.name}</p>
              <p className="text-2xl font-bold">{it.price}<span className="text-xs text-gray-500 font-normal">{it.period}</span></p>
              <ul className="mt-3 space-y-1">
                {(it.features || []).map((f, fi) => <li key={fi} className="text-xs text-gray-600">{f}</li>)}
              </ul>
            </div>
          ))}
        </div>
      )
    }

    case 'contact':
      return (
        <div className={pad}>
          <h3 className="font-bold mb-3">{(content.title as string) || 'Contactez-nous'}</h3>
          <div className="space-y-1 text-sm text-gray-600">
            {(content.email as string) && <p>Email: {content.email as string}</p>}
            {(content.phone as string) && <p>Tel: {content.phone as string}</p>}
            {(content.address as string) && <p>Adresse: {content.address as string}</p>}
            {!(content.email as string) && !(content.phone as string) && <p className="text-gray-400 italic">Remplissez les coordonnees...</p>}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="h-8 bg-gray-100 rounded" />
            <div className="h-8 bg-gray-100 rounded" />
            <div className="col-span-2 h-16 bg-gray-100 rounded" />
            <div className="col-span-2 h-8 bg-[#F5A623]/20 rounded flex items-center justify-center text-xs text-[#F5A623] font-semibold">Envoyer</div>
          </div>
        </div>
      )

    case 'map':
      return (
        <div className={pad}>
          <div className="w-full h-40 bg-gray-200 rounded-lg flex flex-col items-center justify-center text-gray-400">
            <SectionIcon type="map" size={32} />
            <span className="text-xs mt-1">{(content.address as string) || 'Adresse non definie'}</span>
          </div>
        </div>
      )

    case 'faq': {
      const items = (content.items as Array<{ question: string; answer: string }>) || []
      return (
        <div className={`${pad} space-y-2`}>
          {items.map((it, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-3">
              <p className="font-semibold text-sm">{it.question}</p>
              <p className="text-xs text-gray-500 mt-1">{it.answer}</p>
            </div>
          ))}
        </div>
      )
    }

    case 'video':
      return (
        <div className={pad}>
          <div className="w-full aspect-video bg-gray-900 rounded-lg flex items-center justify-center">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="white" stroke="none"><polygon points="8,5 19,12 8,19"/></svg>
          </div>
          {(content.title as string) && <p className="text-sm text-gray-700 mt-2 text-center">{content.title as string}</p>}
        </div>
      )

    case 'features': {
      const items = (content.items as Array<{ icon: string; title: string; description: string }>) || []
      return (
        <div className={`${pad} grid grid-cols-3 gap-3`}>
          {items.map((it, i) => (
            <div key={i} className="text-center p-3 rounded-lg bg-gray-50">
              <div className="w-8 h-8 mx-auto mb-2 rounded-full bg-[#F5A623]/10 text-[#F5A623] flex items-center justify-center">
                <SectionIcon type="features" size={16} />
              </div>
              <p className="text-sm font-semibold">{it.title}</p>
              <p className="text-xs text-gray-500 mt-1">{it.description}</p>
            </div>
          ))}
        </div>
      )
    }

    default:
      return <div className={pad}><p className="text-gray-400">Section inconnue</p></div>
  }
}

// ---------------------------------------------------------------------------
// Sortable Section Wrapper
// ---------------------------------------------------------------------------

interface SortableSectionProps {
  section: Section
  isSelected: boolean
  isPreview: boolean
  onSelect: () => void
  onDuplicate: () => void
  onDelete: () => void
}

function SortableSection({ section, isSelected, isPreview, onSelect, onDuplicate, onDelete }: SortableSectionProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  if (isPreview) {
    return (
      <div style={{ backgroundColor: section.settings.background }}>
        <div className={section.settings.fullWidth ? '' : 'max-w-4xl mx-auto'}>
          <SectionPreview section={section} />
        </div>
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`group relative rounded-lg border-2 transition-colors mb-3 cursor-pointer ${
        isSelected
          ? 'border-[#F5A623] shadow-lg shadow-[#F5A623]/10'
          : 'border-transparent hover:border-blue-400'
      }`}
    >
      {/* Action bar on hover */}
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 hidden group-hover:flex items-center gap-1 bg-white border border-gray-200 rounded-full shadow-md px-2 py-1 z-10">
        <button
          {...attributes}
          {...listeners}
          className="p-1 text-gray-400 hover:text-gray-700 cursor-grab active:cursor-grabbing"
          title="Deplacer"
          onClick={(e) => e.stopPropagation()}
        >
          <DragIcon />
        </button>
        <button
          className="p-1 text-gray-400 hover:text-blue-600"
          title="Dupliquer"
          onClick={(e) => { e.stopPropagation(); onDuplicate() }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
        </button>
        <button
          className="p-1 text-gray-400 hover:text-red-600"
          title="Supprimer"
          onClick={(e) => { e.stopPropagation(); onDelete() }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
        </button>
      </div>

      {/* Type badge */}
      <div className="absolute top-2 left-2 z-10 flex items-center gap-1 bg-white/90 backdrop-blur text-xs font-medium text-gray-600 px-2 py-0.5 rounded-full border border-gray-200">
        <SectionIcon type={section.type} size={12} />
        {section.type}
      </div>

      <div style={{ backgroundColor: section.settings.background }} className="rounded-lg overflow-hidden">
        <SectionPreview section={section} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Right Panel – Properties Editor
// ---------------------------------------------------------------------------

interface PropertiesEditorProps {
  section: Section
  onChange: (updated: Section) => void
}

function PropertiesEditor({ section, onChange }: PropertiesEditorProps) {
  const updateContent = (key: string, value: unknown) => {
    onChange({ ...section, content: { ...section.content, [key]: value } })
  }

  const updateSettings = (key: keyof SectionSettings, value: unknown) => {
    onChange({ ...section, settings: { ...section.settings, [key]: value } })
  }

  const updateItemField = (arrKey: string, index: number, field: string, value: unknown) => {
    const items = [...(section.content[arrKey] as Array<Record<string, unknown>>)]
    items[index] = { ...items[index], [field]: value }
    updateContent(arrKey, items)
  }

  const addItem = (arrKey: string, template: Record<string, unknown>) => {
    const items = [...(section.content[arrKey] as Array<Record<string, unknown>>)]
    items.push({ ...template })
    updateContent(arrKey, items)
  }

  const removeItem = (arrKey: string, index: number) => {
    const items = [...(section.content[arrKey] as Array<Record<string, unknown>>)]
    items.splice(index, 1)
    updateContent(arrKey, items)
  }

  // shared field renderers
  const textField = (label: string, key: string, multiline = false) => (
    <div key={key} className="mb-3">
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {multiline ? (
        <textarea
          className="w-full text-sm border border-gray-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-[#F5A623]/40 resize-y"
          rows={3}
          value={(section.content[key] as string) || ''}
          onChange={(e) => updateContent(key, e.target.value)}
        />
      ) : (
        <input
          type="text"
          className="w-full text-sm border border-gray-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-[#F5A623]/40"
          value={(section.content[key] as string) || ''}
          onChange={(e) => updateContent(key, e.target.value)}
        />
      )}
    </div>
  )

  // Render content fields based on type
  function renderContentFields() {
    switch (section.type) {
      case 'hero':
        return (<>{textField('Titre', 'title')}{textField('Sous-titre', 'subtitle')}{textField('Texte du bouton', 'cta_text')}{textField('URL du bouton', 'cta_url')}{textField('Image de fond (URL)', 'background_image')}</>)
      case 'text':
        return (<>{textField('Titre', 'title')}{textField('Contenu', 'body', true)}</>)
      case 'image':
        return (<>{textField('URL de l\'image', 'url')}{textField('Texte alternatif', 'alt')}{textField('Legende', 'caption')}</>)
      case 'cta':
        return (<>{textField('Titre', 'title')}{textField('Sous-titre', 'subtitle')}{textField('Texte du bouton', 'button_text')}{textField('URL du bouton', 'button_url')}</>)
      case 'contact':
        return (<>{textField('Titre', 'title')}{textField('Email', 'email')}{textField('Telephone', 'phone')}{textField('Adresse', 'address')}</>)
      case 'map':
        return (<>{textField('Adresse', 'address')}<div className="mb-3"><label className="block text-xs font-medium text-gray-600 mb-1">Zoom</label><input type="number" min="1" max="20" className="w-full text-sm border border-gray-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-[#F5A623]/40" value={(section.content.zoom as number) || 15} onChange={(e) => updateContent('zoom', parseInt(e.target.value, 10))}/></div></>)
      case 'video':
        return (<>{textField('URL de la video', 'url')}{textField('Titre', 'title')}</>)
      case 'gallery':
        return renderArrayItems('items', { title: '', url: '', description: '' }, ['title', 'url', 'description'], ['Titre', 'URL', 'Description'])
      case 'testimonials':
        return renderArrayItems('items', { name: 'Client', text: '', rating: 5 }, ['name', 'text', 'rating'], ['Nom', 'Texte', 'Note (1-5)'])
      case 'pricing':
        return renderPricingItems()
      case 'faq':
        return renderArrayItems('items', { question: '', answer: '' }, ['question', 'answer'], ['Question', 'Reponse'])
      case 'features':
        return renderArrayItems('items', { icon: 'star', title: '', description: '' }, ['icon', 'title', 'description'], ['Icone', 'Titre', 'Description'])
      default:
        return null
    }
  }

  function renderArrayItems(arrKey: string, template: Record<string, unknown>, fields: string[], labels: string[]) {
    const items = (section.content[arrKey] as Array<Record<string, unknown>>) || []
    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Elements ({items.length})</span>
          <button
            onClick={() => addItem(arrKey, template)}
            className="text-xs text-[#F5A623] hover:text-[#d4891c] font-medium"
          >+ Ajouter</button>
        </div>
        {items.map((item, idx) => (
          <div key={idx} className="bg-gray-50 rounded-lg p-3 mb-2 relative">
            <button
              onClick={() => removeItem(arrKey, idx)}
              className="absolute top-2 right-2 text-gray-400 hover:text-red-500"
              title="Supprimer"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <p className="text-[10px] font-bold text-gray-400 mb-2">#{idx + 1}</p>
            {fields.map((f, fi) => (
              <div key={f} className="mb-2">
                <label className="block text-[10px] text-gray-500 mb-0.5">{labels[fi]}</label>
                {f === 'text' || f === 'answer' || f === 'description' ? (
                  <textarea
                    className="w-full text-xs border border-gray-200 rounded p-1.5 focus:outline-none focus:ring-1 focus:ring-[#F5A623]/40 resize-y"
                    rows={2}
                    value={(item[f] as string) || ''}
                    onChange={(e) => updateItemField(arrKey, idx, f, e.target.value)}
                  />
                ) : f === 'rating' ? (
                  <input
                    type="number"
                    min="1"
                    max="5"
                    className="w-full text-xs border border-gray-200 rounded p-1.5 focus:outline-none focus:ring-1 focus:ring-[#F5A623]/40"
                    value={(item[f] as number) || 5}
                    onChange={(e) => updateItemField(arrKey, idx, f, parseInt(e.target.value, 10))}
                  />
                ) : (
                  <input
                    type="text"
                    className="w-full text-xs border border-gray-200 rounded p-1.5 focus:outline-none focus:ring-1 focus:ring-[#F5A623]/40"
                    value={(item[f] as string) || ''}
                    onChange={(e) => updateItemField(arrKey, idx, f, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    )
  }

  function renderPricingItems() {
    const items = (section.content.items as Array<Record<string, unknown>>) || []
    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Tarifs ({items.length})</span>
          <button
            onClick={() => addItem('items', { name: 'Plan', price: '0', period: '/mois', features: ['Feature'], highlighted: false })}
            className="text-xs text-[#F5A623] hover:text-[#d4891c] font-medium"
          >+ Ajouter</button>
        </div>
        {items.map((item, idx) => (
          <div key={idx} className="bg-gray-50 rounded-lg p-3 mb-2 relative">
            <button onClick={() => removeItem('items', idx)} className="absolute top-2 right-2 text-gray-400 hover:text-red-500" title="Supprimer">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <p className="text-[10px] font-bold text-gray-400 mb-2">#{idx + 1}</p>
            <div className="mb-2"><label className="block text-[10px] text-gray-500 mb-0.5">Nom</label><input type="text" className="w-full text-xs border border-gray-200 rounded p-1.5 focus:outline-none focus:ring-1 focus:ring-[#F5A623]/40" value={(item.name as string) || ''} onChange={(e) => updateItemField('items', idx, 'name', e.target.value)}/></div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div><label className="block text-[10px] text-gray-500 mb-0.5">Prix</label><input type="text" className="w-full text-xs border border-gray-200 rounded p-1.5 focus:outline-none focus:ring-1 focus:ring-[#F5A623]/40" value={(item.price as string) || ''} onChange={(e) => updateItemField('items', idx, 'price', e.target.value)}/></div>
              <div><label className="block text-[10px] text-gray-500 mb-0.5">Periode</label><input type="text" className="w-full text-xs border border-gray-200 rounded p-1.5 focus:outline-none focus:ring-1 focus:ring-[#F5A623]/40" value={(item.period as string) || ''} onChange={(e) => updateItemField('items', idx, 'period', e.target.value)}/></div>
            </div>
            <div className="mb-2">
              <div className="flex items-center gap-2 mb-1">
                <label className="block text-[10px] text-gray-500">Features</label>
                <button className="text-[10px] text-[#F5A623]" onClick={() => {
                  const feats = [...((item.features as string[]) || []), 'Nouvelle feature']
                  updateItemField('items', idx, 'features', feats)
                }}>+ Ajouter</button>
              </div>
              {((item.features as string[]) || []).map((feat, fi) => (
                <div key={fi} className="flex gap-1 mb-1">
                  <input type="text" className="flex-1 text-xs border border-gray-200 rounded p-1 focus:outline-none focus:ring-1 focus:ring-[#F5A623]/40" value={feat} onChange={(e) => {
                    const feats = [...((item.features as string[]) || [])]
                    feats[fi] = e.target.value
                    updateItemField('items', idx, 'features', feats)
                  }}/>
                  <button className="text-red-400 hover:text-red-600 text-xs px-1" onClick={() => {
                    const feats = [...((item.features as string[]) || [])]
                    feats.splice(fi, 1)
                    updateItemField('items', idx, 'features', feats)
                  }}>x</button>
                </div>
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
              <input type="checkbox" checked={!!item.highlighted} onChange={(e) => updateItemField('items', idx, 'highlighted', e.target.checked)} className="rounded text-[#F5A623] focus:ring-[#F5A623]" />
              Mis en avant
            </label>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      {/* Section type header */}
      <div className="flex items-center gap-2 mb-5 pb-3 border-b border-gray-100">
        <div className="w-8 h-8 rounded-lg bg-[#F5A623]/10 text-[#F5A623] flex items-center justify-center">
          <SectionIcon type={section.type} size={18} />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900 capitalize">{section.type}</p>
          <p className="text-[10px] text-gray-400">ID: {section.id.slice(0, 8)}</p>
        </div>
      </div>

      {/* Content fields */}
      <div className="mb-5">
        <h4 className="text-xs font-semibold text-gray-800 uppercase tracking-wide mb-3">Contenu</h4>
        {renderContentFields()}
      </div>

      {/* Settings */}
      <div>
        <h4 className="text-xs font-semibold text-gray-800 uppercase tracking-wide mb-3">Parametres</h4>

        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-600 mb-1">Couleur de fond</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={section.settings.background}
              onChange={(e) => updateSettings('background', e.target.value)}
              className="w-8 h-8 rounded border border-gray-200 cursor-pointer"
            />
            <input
              type="text"
              value={section.settings.background}
              onChange={(e) => updateSettings('background', e.target.value)}
              className="flex-1 text-xs border border-gray-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-[#F5A623]/40"
            />
          </div>
        </div>

        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-600 mb-1">Padding</label>
          <div className="grid grid-cols-4 gap-1">
            {(['sm', 'md', 'lg', 'xl'] as const).map((p) => (
              <button
                key={p}
                onClick={() => updateSettings('padding', p)}
                className={`text-xs py-1.5 rounded-lg font-medium transition-colors ${
                  section.settings.padding === p
                    ? 'bg-[#F5A623] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >{p.toUpperCase()}</button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={section.settings.fullWidth}
            onChange={(e) => updateSettings('fullWidth', e.target.checked)}
            className="rounded text-[#F5A623] focus:ring-[#F5A623]"
          />
          Pleine largeur
        </label>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Toast Component
// ---------------------------------------------------------------------------

function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  useEffect(() => {
    if (!toast.visible) return undefined
    const t = setTimeout(onClose, 3000)
    return () => clearTimeout(t)
  }, [toast.visible, onClose])

  if (!toast.visible) return null

  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
      toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
    }`}>
      {toast.type === 'success' ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
      )}
      {toast.message}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function PageEditorPage() {
  const params = useParams<{ siteId: string; pageId: string }>()
  const router = useRouter()
  const supabase = useMemo(() => createBrowserClient(), [])

  const [pageData, setPageData] = useState<PageData | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [previewMode, setPreviewMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<ToastState>({ message: '', type: 'success', visible: false })

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type, visible: true })
  }, [])

  const closeToast = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }))
  }, [])

  // DnD sensors
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // Load page data
  const loadPage = useCallback(async () => {
    if (!params.pageId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('site_pages')
      .select('*')
      .eq('id', params.pageId)
      .single()

    if (error || !data) {
      showToast('Erreur lors du chargement de la page', 'error')
      setLoading(false)
      return
    }

    setPageData({
      id: data.id,
      title: data.title || 'Sans titre',
      slug: data.slug || '',
      sections: [],
    })

    const parsed = Array.isArray(data.sections) ? (data.sections as Section[]) : []
    setSections(parsed)
    setLoading(false)
  }, [params.pageId, supabase, showToast])

  useEffect(() => {
    loadPage()
  }, [loadPage])

  // Save
  const handleSave = async () => {
    if (!params.pageId) return
    setSaving(true)
    const { error } = await supabase
      .from('site_pages')
      .update({ sections, updated_at: new Date().toISOString() })
      .eq('id', params.pageId)

    if (error) {
      showToast('Erreur lors de la sauvegarde', 'error')
    } else {
      showToast('Page sauvegardee avec succes', 'success')
    }
    setSaving(false)
  }

  // Add section
  const addSection = (type: SectionType) => {
    const newSection: Section = {
      id: crypto.randomUUID(),
      type,
      content: getDefaultContent(type),
      settings: { ...defaultSettings },
    }
    setSections((prev) => [...prev, newSection])
    setSelectedId(newSection.id)
  }

  // Duplicate section
  const duplicateSection = (id: string) => {
    const idx = sections.findIndex((s) => s.id === id)
    if (idx === -1) return
    const original = sections[idx]
    const clone: Section = {
      ...JSON.parse(JSON.stringify(original)),
      id: crypto.randomUUID(),
    }
    const next = [...sections]
    next.splice(idx + 1, 0, clone)
    setSections(next)
    setSelectedId(clone.id)
  }

  // Delete section
  const deleteSection = (id: string) => {
    setSections((prev) => prev.filter((s) => s.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  // Update section
  const updateSection = (updated: Section) => {
    setSections((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
  }

  // DnD handler
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setSections((prev) => {
      const oldIndex = prev.findIndex((s) => s.id === active.id)
      const newIndex = prev.findIndex((s) => s.id === over.id)
      return arrayMove(prev, oldIndex, newIndex)
    })
  }

  const selectedSection = sections.find((s) => s.id === selectedId) || null

  // Loading
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#F5A623] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Chargement de l&apos;editeur...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100 overflow-hidden">
      {/* ===== TOP TOOLBAR ===== */}
      <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/sites/${params.siteId}`)}
            className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
            Retour
          </button>
          <div className="w-px h-6 bg-gray-200" />
          <h1 className="text-sm font-semibold text-gray-900 truncate max-w-[200px]">{pageData?.title || 'Page'}</h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Preview / Edit toggle */}
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => { setPreviewMode(false); setSelectedId(null) }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                !previewMode ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="flex items-center gap-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                Editer
              </span>
            </button>
            <button
              onClick={() => { setPreviewMode(true); setSelectedId(null) }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                previewMode ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="flex items-center gap-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                Apercu
              </span>
            </button>
          </div>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 bg-[#F5A623] hover:bg-[#d4891c] disabled:opacity-50 text-white px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors"
          >
            {saving ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17,21 17,13 7,13 7,21"/><polyline points="7,3 7,8 15,8"/></svg>
            )}
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        </div>
      </div>

      {/* ===== MAIN LAYOUT ===== */}
      <div className="flex flex-1 overflow-hidden">

        {/* ----- LEFT SIDEBAR ----- */}
        {!previewMode && (
          <div className="w-[240px] bg-white border-r border-gray-200 flex flex-col shrink-0 overflow-y-auto">
            <div className="p-3 border-b border-gray-100">
              <h2 className="text-xs font-semibold text-gray-800 uppercase tracking-wide">Sections</h2>
              <p className="text-[10px] text-gray-400 mt-0.5">Cliquez pour ajouter</p>
            </div>
            <div className="p-3 grid grid-cols-2 gap-2">
              {SECTION_TYPES.map(({ type, label }) => (
                <button
                  key={type}
                  onClick={() => addSection(type)}
                  className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-lg border border-gray-200 hover:border-[#F5A623] hover:bg-[#F5A623]/5 transition-colors group"
                >
                  <span className="text-gray-400 group-hover:text-[#F5A623] transition-colors">
                    <SectionIcon type={type} size={22} />
                  </span>
                  <span className="text-[10px] font-medium text-gray-600 group-hover:text-gray-900">{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ----- CENTER CANVAS ----- */}
        <div
          className="flex-1 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedId(null)
          }}
        >
          {previewMode ? (
            /* Preview mode: full-width clean render */
            <div className="min-h-full bg-white">
              {sections.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-400 text-sm py-32">
                  Aucune section
                </div>
              ) : (
                sections.map((section) => (
                  <SortableSection
                    key={section.id}
                    section={section}
                    isSelected={false}
                    isPreview={true}
                    onSelect={() => {}}
                    onDuplicate={() => {}}
                    onDelete={() => {}}
                  />
                ))
              )}
            </div>
          ) : (
            /* Edit mode: DnD canvas */
            <div className="max-w-3xl mx-auto py-6 px-4">
              {sections.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 text-center">
                  <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center mb-4">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                  </div>
                  <p className="text-sm text-gray-500 font-medium">Ajoutez des sections depuis le panneau de gauche</p>
                  <p className="text-xs text-gray-400 mt-1">Glissez-deposez pour reorganiser</p>
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={sections.map((s) => s.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {sections.map((section) => (
                      <SortableSection
                        key={section.id}
                        section={section}
                        isSelected={selectedId === section.id}
                        isPreview={false}
                        onSelect={() => setSelectedId(section.id)}
                        onDuplicate={() => duplicateSection(section.id)}
                        onDelete={() => deleteSection(section.id)}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              )}
            </div>
          )}
        </div>

        {/* ----- RIGHT PANEL ----- */}
        {!previewMode && (
          <div className="w-[320px] bg-white border-l border-gray-200 shrink-0 overflow-y-auto">
            <div className="p-4">
              {selectedSection ? (
                <PropertiesEditor
                  section={selectedSection}
                  onChange={updateSection}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
                  </div>
                  <p className="text-sm text-gray-500">Selectionnez une section pour modifier ses proprietes</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Toast */}
      <Toast toast={toast} onClose={closeToast} />
    </div>
  )
}
