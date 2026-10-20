/**
 * Date and Timezone Utilities for MediMate
 */

/**
 * Calculates accurate age from Date of Birth
 * @param {Date|string} dateOfBirth 
 * @returns {number} Age in full years
 */
export function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return 0;
  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) return 0;

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }

  return Math.max(0, age);
}

/**
 * Returns current date string 'YYYY-MM-DD' formatted in the given timezone (default: Asia/Kolkata)
 * @param {string} timezone 
 * @param {Date} [baseDate=new Date()]
 * @returns {string} 'YYYY-MM-DD'
 */
export function getLocalDateString(timezone = 'Asia/Kolkata', baseDate = new Date()) {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(baseDate); // en-CA gives YYYY-MM-DD
  } catch {
    return baseDate.toISOString().split('T')[0];
  }
}

/**
 * Converts a date ('YYYY-MM-DD') and 24-hr time ('HH:MM') in a specified timezone to a UTC Date object
 * @param {string} dateStr 'YYYY-MM-DD'
 * @param {string} timeStr 'HH:MM'
 * @param {string} timezone 'Asia/Kolkata'
 * @returns {Date}
 */
export function parseLocalTimeToUtc(dateStr, timeStr, timezone = 'Asia/Kolkata') {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);

  // Use Intl to find the exact UTC offset for this specific timezone and date
  const tempUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  
  // Format the tempUtc in target timezone to calculate the offset difference
  const tzParts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false
  }).formatToParts(tempUtc);

  const getPart = (type) => Number(tzParts.find(p => p.type === type)?.value || 0);
  const tzHour = getPart('hour') === 24 ? 0 : getPart('hour');
  const tzYear = getPart('year');
  const tzMonth = getPart('month');
  const tzDay = getPart('day');
  const tzMinute = getPart('minute');

  const tzDateAsUtc = Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMinute, 0);
  const offsetDiffMs = tzDateAsUtc - tempUtc.getTime();

  return new Date(tempUtc.getTime() - offsetDiffMs);
}

/**
 * Format a UTC Date to 12-hour time string in patient timezone (e.g. '08:30 AM')
 * @param {Date|string} date 
 * @param {string} timezone 
 * @returns {string}
 */
export function formatToLocalTime(date, timezone = 'Asia/Kolkata') {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';

  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(d);
}
