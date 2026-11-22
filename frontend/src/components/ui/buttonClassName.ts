import { cx } from '@/lib/cx'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost'
export type ButtonSize = 'md' | 'sm'

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-full font-medium tracking-wide transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-background hover:bg-accent-strong',
  secondary: 'border border-accent/60 text-accent hover:border-accent hover:bg-accent/10',
  ghost: 'text-muted hover:text-foreground',
}

const SIZES: Record<ButtonSize, string> = {
  md: 'min-h-12 px-6 text-base',
  sm: 'min-h-10 px-4 text-sm',
}

/** Button styles, shared by <button>, router links and plain <a> elements. */
export function buttonClassName(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  className?: string,
) {
  return cx(BASE, VARIANTS[variant], SIZES[size], className)
}
