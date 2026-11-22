import type { Language } from '@/i18n/languages'
import type { OpeningHour } from '@/types/catalog'

export const RESTAURANT_TIME_ZONE = 'Africa/Casablanca'
const LOCALES: Record<Language, string> = { fr: 'fr-MA', ar: 'ar-MA', en: 'en-GB' }
const WEEKDAY_INDEX: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
}

/** Today's weekday (0 = Monday) in the restaurant's timezone, not the visitor's. */
export function restaurantWeekday(now: Date = new Date()): number {
  const short = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: RESTAURANT_TIME_ZONE,
  }).format(now)
  return WEEKDAY_INDEX[short] ?? 0
}

/** Localised weekday name; 1 January 2024 was a Monday. */
export function weekdayName(weekday: number, language: Language): string {
  return new Intl.DateTimeFormat(LOCALES[language], { weekday: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(2024, 0, 1 + weekday)),
  )
}

/** "12:00:00" → "12:00" */
export function formatTime(value: string | null): string {
  return value ? value.slice(0, 5) : ''
}

export interface DaySchedule {
  weekday: number
  slots: string[] // e.g. ["12:00–15:00", "19:00–23:30"]
}

export function weeklySchedule(hours: OpeningHour[]): DaySchedule[] {
  return Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    slots: hours
      .filter((slot) => slot.weekday === weekday && !slot.is_closed)
      .sort((a, b) => (a.opens_at ?? '').localeCompare(b.opens_at ?? ''))
      .map((slot) => `${formatTime(slot.opens_at)}–${formatTime(slot.closes_at)}`),
  }))
}
