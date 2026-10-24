'use strict';

// Opening hours are interpreted in India Standard Time.
const TZ = 'Asia/Kolkata';

function nowInIST(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t).value;
  const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    day: dayMap[get('weekday')],
    minutes: (parseInt(get('hour'), 10) % 24) * 60 + parseInt(get('minute'), 10),
  };
}

const toMinutes = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map((n) => parseInt(n, 10));
  return h * 60 + (m || 0);
};

/**
 * Is the restaurant open right now?
 * Needs: manual switch (isOpen) AND the weekly schedule. Supports closing after midnight (e.g. 18:00-02:00).
 */
function isRestaurantOpenNow(restaurant, date = new Date()) {
  if (!restaurant || restaurant.isOpen === false) return false;
  const hours = restaurant.openingHours;
  if (!hours || hours.length === 0) return true;
  const { day, minutes } = nowInIST(date);
  const prevDay = (day + 6) % 7;

  const slot = hours.find((h) => h.day === day);
  if (slot && !slot.closed) {
    const open = toMinutes(slot.open);
    const close = toMinutes(slot.close);
    if (close > open) {
      if (minutes >= open && minutes < close) return true;
    } else if (minutes >= open) {
      return true; // runs past midnight
    }
  }
  const prev = hours.find((h) => h.day === prevDay);
  if (prev && !prev.closed) {
    const open = toMinutes(prev.open);
    const close = toMinutes(prev.close);
    if (close <= open && minutes < close) return true; // tail of yesterday's late shift
  }
  return false;
}

module.exports = { isRestaurantOpenNow, nowInIST, TZ };
