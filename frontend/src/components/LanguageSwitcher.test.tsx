import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { LanguageSwitcher } from './LanguageSwitcher'

describe('LanguageSwitcher', () => {
  it('marks the active language', () => {
    render(<LanguageSwitcher />)

    expect(screen.getByRole('button', { name: /Français/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /العربية/ })).toHaveAttribute('aria-pressed', 'false')
  })

  it('switches to Arabic and mirrors the layout', async () => {
    const user = userEvent.setup()
    render(<LanguageSwitcher />)

    await user.click(screen.getByRole('button', { name: /العربية/ }))

    expect(document.documentElement.dir).toBe('rtl')
    expect(screen.getByRole('group', { name: 'اللغة' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /العربية/ })).toHaveAttribute('aria-pressed', 'true')
  })
})
