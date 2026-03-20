interface LogoProps {
  variant?: 'light' | 'dark'
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const SIZES = {
  sm: 'text-lg',
  md: 'text-xl',
  lg: 'text-2xl',
  xl: 'text-3xl',
}

export function Logo({ variant = 'light', size = 'md' }: LogoProps) {
  const baseColor = variant === 'dark' ? 'text-white' : 'text-gray-900'

  return (
    <span className={`${SIZES[size]} font-extrabold tracking-tight`}>
      <span className={baseColor}>WAPIX</span>
      <span style={{ color: '#F5A623' }}>IA</span>
    </span>
  )
}

export function LogoIcon({ variant = 'light', size = 'md' }: LogoProps) {
  const baseColor = variant === 'dark' ? 'text-white' : 'text-gray-900'

  return (
    <span className={`${SIZES[size]} font-extrabold tracking-tight`}>
      <span style={{ color: '#F5A623' }}>&gt;</span>
      <span className={baseColor === 'text-white' ? 'text-white' : ''} style={baseColor !== 'text-white' ? { color: '#F5A623' } : {}}>
        {' '}
      </span>
      <span style={{ color: '#F5A623' }}>IA</span>
    </span>
  )
}
