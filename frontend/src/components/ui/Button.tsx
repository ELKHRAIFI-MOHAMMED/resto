import type { ButtonHTMLAttributes } from 'react'
import { Link, type LinkProps } from 'react-router'

import { buttonClassName, type ButtonSize, type ButtonVariant } from './buttonClassName'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

export function Button({ variant, size, className, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={buttonClassName(variant, size, className)} {...props} />
}

interface ButtonLinkProps extends LinkProps {
  variant?: ButtonVariant
  size?: ButtonSize
}

export function ButtonLink({ variant, size, className, ...props }: ButtonLinkProps) {
  return (
    <Link className={buttonClassName(variant, size, className as string | undefined)} {...props} />
  )
}
