from collections.abc import Iterable
from datetime import datetime, time, timedelta

from django.utils import timezone

from .models import OpeningHour, Restaurant


def _slot_covers(slot: OpeningHour, moment: time, *, previous_day: bool) -> bool:
    opens, closes = slot.opens_at, slot.closes_at
    overnight = closes <= opens
    if previous_day:
        # Only overnight slots from yesterday spill into today.
        return overnight and moment < closes
    if overnight:
        return moment >= opens
    return opens <= moment < closes


def is_open_at(slots: Iterable[OpeningHour], when: datetime) -> bool:
    """Whether any opening slot covers `when` (converted to the restaurant's timezone)."""
    local = timezone.localtime(when)
    today = local.weekday()
    yesterday = (local - timedelta(days=1)).weekday()
    moment = local.time()

    for slot in slots:
        if slot.is_closed or slot.opens_at is None or slot.closes_at is None:
            continue
        if slot.weekday == today and _slot_covers(slot, moment, previous_day=False):
            return True
        if slot.weekday == yesterday and _slot_covers(slot, moment, previous_day=True):
            return True
    return False


def is_open_now(restaurant: Restaurant) -> bool:
    return is_open_at(restaurant.opening_hours.all(), timezone.now())
