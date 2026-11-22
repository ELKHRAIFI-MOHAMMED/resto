import { Minus, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cx } from '@/lib/cx'
import { MAX_ITEM_QUANTITY } from '@/store/cart'

interface QuantityStepperProps {
  value: number
  onChange: (value: number) => void
  label: string
  min?: number
  max?: number
  size?: 'md' | 'sm'
}

export function QuantityStepper({
  value,
  onChange,
  label,
  min = 1,
  max = MAX_ITEM_QUANTITY,
  size = 'md',
}: QuantityStepperProps) {
  const { t } = useTranslation()
  const button = cx(
    'flex items-center justify-center rounded-full text-foreground transition-colors hover:bg-surface-raised disabled:opacity-40 disabled:hover:bg-transparent',
    size === 'md' ? 'size-11' : 'size-9',
  )

  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex items-center gap-1 rounded-full border border-border p-0.5"
    >
      <button
        type="button"
        className={button}
        onClick={() => onChange(value - 1)}
        disabled={value <= min}
        aria-label={t('product.decrease')}
      >
        <Minus aria-hidden className="size-4" />
      </button>
      <output aria-live="polite" className="min-w-8 text-center tabular-nums">
        {value}
      </output>
      <button
        type="button"
        className={button}
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label={t('product.increase')}
      >
        <Plus aria-hidden className="size-4" />
      </button>
    </div>
  )
}
