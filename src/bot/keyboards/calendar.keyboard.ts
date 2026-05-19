import { Markup } from 'telegraf';

const UZ_MONTHS = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
];

const UZ_WEEKDAYS = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];

export interface ScheduleInfo {
  workDays: number[];
  blockedDates: string[];
  extraWorkDates: string[];
}

function isWorkingDay(date: Date, dateStr: string, schedule?: ScheduleInfo): boolean {
  if (!schedule) {
    return date.getDay() !== 0; // eski xatti-harakat: faqat yakshanba dam olish
  }
  const workDays = (schedule.workDays || []).map(Number);
  if ((schedule.extraWorkDates || []).includes(dateStr)) return true;
  if ((schedule.blockedDates || []).includes(dateStr)) return false;
  const dow = date.getDay() === 0 ? 7 : date.getDay();
  return workDays.includes(dow);
}

export function buildCalendarKeyboard(year: number, month: number, schedule?: ScheduleInfo) {
  const todayUz = uzNow();
  const today = new Date(Date.UTC(todayUz.getUTCFullYear(), todayUz.getUTCMonth(), todayUz.getUTCDate()));

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const rows: any[][] = [];

  // Sarlavha
  rows.push([
    Markup.button.callback('◀️', `cal:prev:${year}:${month}`),
    Markup.button.callback(`${UZ_MONTHS[month]} ${year}`, 'cal:ignore'),
    Markup.button.callback('▶️', `cal:next:${year}:${month}`),
  ]);

  rows.push(UZ_WEEKDAYS.map((d) => Markup.button.callback(d, 'cal:ignore')));

  let dayRow: any[] = [];
  for (let i = 0; i < startDow; i++) {
    dayRow.push(Markup.button.callback(' ', 'cal:ignore'));
  }

  for (let day = 1; day <= lastDay.getDate(); day++) {
    const date = new Date(year, month, day);
    const dateStr = formatDate(year, month + 1, day);
    const isPast = date < today;
    const working = isWorkingDay(date, dateStr, schedule);

    let label: string;
    let cb: string;

    if (isPast) {
      label = String(day);
      cb = 'cal:ignore';
    } else if (working) {
      label = `${day} 🟢`;   // ish kuni — bosiladi
      cb = `cal:select:${dateStr}`;
    } else {
      label = `${day} 🔴`;   // dam olish — bosilmaydi
      cb = 'cal:ignore';
    }

    dayRow.push(Markup.button.callback(label, cb));

    if (dayRow.length === 7) {
      rows.push(dayRow);
      dayRow = [];
    }
  }

  if (dayRow.length > 0) {
    while (dayRow.length < 7) {
      dayRow.push(Markup.button.callback(' ', 'cal:ignore'));
    }
    rows.push(dayRow);
  }

  rows.push([
    Markup.button.callback('⬅️ Xizmat tanlash', 'cal:back'),
    Markup.button.callback('❌ Bekor qilish', 'cal:cancel'),
  ]);

  return Markup.inlineKeyboard(rows);
}

function uzNow(): Date {
  return new Date(Date.now() + 5 * 60 * 60 * 1000);
}

function uzTodayStr(): string {
  const d = uzNow();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function buildTimeKeyboard(
  slots: { time: string; id: number; isBooked: boolean }[],
  selectedDate?: string,
) {
  const now = uzNow();
  const todayStr = uzTodayStr();
  const isToday = selectedDate === todayStr;
  const nowMinutes = isToday ? now.getUTCHours() * 60 + now.getUTCMinutes() : -1;

  const visibleSlots = isToday
    ? slots.filter((s) => {
        const [h, m] = s.time.split(':').map(Number);
        return h * 60 + m > nowMinutes;
      })
    : slots;

  const rows: any[][] = [];
  let row: any[] = [];

  for (const slot of visibleSlots) {
    const label = fmtTime(slot.time);
    if (slot.isBooked) {
      row.push(Markup.button.callback(`🔴 ${label}`, 'time:booked'));
    } else {
      row.push(Markup.button.callback(`🟢 ${label}`, `time:${slot.id}`));
    }
    if (row.length === 3) {
      rows.push(row);
      row = [];
    }
  }
  if (row.length > 0) rows.push(row);
  rows.push([
    Markup.button.callback('⬅️ Sanaga qaytish', 'time:back'),
    Markup.button.callback('❌ Bekor qilish', 'time:cancel'),
  ]);

  return Markup.inlineKeyboard(rows);
}

// "09:00" → "9:00", "14:00" → "14:00"
export function fmtTime(time: string): string {
  if (!time) return time;
  const [h, m] = time.split(':');
  return m === '00' ? `${parseInt(h)}:00` : `${parseInt(h)}:${m}`;
}

export function buildServicesKeyboard(services: { id: number; name: string; emoji: string }[]) {
  const rows: any[][] = [];
  for (let i = 0; i < services.length; i += 2) {
    const row = [
      Markup.button.callback(`${services[i].emoji || '🦷'} ${services[i].name}`, `svc:${services[i].id}`),
    ];
    if (services[i + 1]) {
      row.push(Markup.button.callback(`${services[i + 1].emoji || '🦷'} ${services[i + 1].name}`, `svc:${services[i + 1].id}`));
    }
    rows.push(row);
  }
  rows.push([
    Markup.button.callback('⬅️ Bosh menyu', 'svc:back'),
    Markup.button.callback('❌ Bekor qilish', 'svc:cancel'),
  ]);
  return Markup.inlineKeyboard(rows);
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export { formatDate };
