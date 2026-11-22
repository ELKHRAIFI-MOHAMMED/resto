import type { ButtonHTMLAttributes } from 'react'
import { Link, type LinkProps } from 'react-router'

import { cx } from '@/lib/cx'

type Variant = 'primary' | 'secondary' | 'ghost'
type Size = 'md' | 'sm'

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-full font-medium tracking-wide transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-background hover:bg-accent-strong',
  secondary: 'border border-accent/60 text-accent hover:border-accent hover:bg-accent/10',
  ghost: 'text-muted hover:text-foreground',
}

const SIZES: Record<Size, string> = {
  md: 'min-h-12 px-6 text-base',
  sm: 'min-h-10 px-4 text-sm',
}

function buttonClasses(variant: Variant = 'primary', size: Size = 'md', className?: string) {
  return cx(BASE, VARIANTS[variant], SIZES[size], className)
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

export function Button({ variant, size, className, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses(variant, size, className)} {...props} />
}

interface ButtonLinkProps extends LinkProps {
  variant?: Variant
  size?: Size
}

export function ButtonLink({ variant, size, className, ...props }: ButtonLinkProps) {
  return (
    <Link className={buttonClasses(variant, size, className as string | undefined)} {...props} />
  )
}
