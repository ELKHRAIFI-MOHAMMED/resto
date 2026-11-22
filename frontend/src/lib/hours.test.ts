import { describe, expect, it } from 'vitest'

import type { OpeningHour } from '@/types/catalog'

import { restaurantWeekday, weekdayName, weeklySchedule } from './hours'

describe('hours helpers', () => {
  it('uses the restaurant timezone for "today"', () => {
    // Sunday 23:30 UTC is Monday 00:30 in Casablanca (UTC+1).
    expect(restaurantWeekday(new Date('2026-11-22T23:30:00Z'))).toBe(0)
    expect(restaurantWeekday(new Date('2026-11-22T12:00:00Z'))).toBe(6)
  })

  it('names weekdays in each language', () => {
    expect(weekdayName(0, 'fr')).toBe('lundi')
    expect(weekdayName(6, 'en')).toBe('Sunday')
    expect(weekdayName(4, 'ar')).toBe('الجمعة')
  })

  it('builds a sorted weekly schedule and skips closed slots', () => {
    const hours: OpeningHour[] = [
      { id: 1, weekday: 0, opens_at: '19:00:00', closes_at: '23:30:00', is_closed: false },
      { id: 2, weekday: 0, opens_at: '12:00:00', closes_at: '15:00:00', is_closed: false },
      { id: 3, weekday: 6, opens_at: null, closes_at: null, is_closed: true },
    ]

    const schedule = weeklySchedule(hours)

    expect(schedule).toHaveLength(7)
    expect(schedule[0]?.slots).toEqual(['12:00–15:00', '19:00–23:30'])
    expect(schedule[6]?.slots).toEqual([])
  })
})
