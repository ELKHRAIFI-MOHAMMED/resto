/** Light / dark theme. Dark is the brand default; the choice is remembered. */
export type Theme = 'dark' | 'light'

export const THEME_STORAGE_KEY = 'restoflow.theme'
const THEME_COLORS: Record<Theme, string> = { dark: '#111111', light: '#f8f5ef' }

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'light') root.dataset.theme = 'light'
  else delete root.dataset.theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme])
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Non-critical: the choice simply won't persist.
  }
}
