export interface MonthYear {
  year: number;
  month: number; // 1-12
}

export function createMonthYear(year: number, month: number): MonthYear {
  return { year, month };
}

export function currentMonthYear(): MonthYear {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  };
}

export function getMonthKey(my: MonthYear): string {
  const m = my.month.toString().padStart(2, '0');
  return `${my.year}-${m}`;
}

export function parseMonthKey(key: string): MonthYear {
  const parts = key.split('-');
  return {
    year: parseInt(parts[0], 10),
    month: parseInt(parts[1], 10),
  };
}

export function previousMonth(my: MonthYear): MonthYear {
  if (my.month === 1) {
    return { year: my.year - 1, month: 12 };
  }
  return { year: my.year, month: my.month - 1 };
}

export function nextMonth(my: MonthYear): MonthYear {
  if (my.month === 12) {
    return { year: my.year + 1, month: 1 };
  }
  return { year: my.year, month: my.month + 1 };
}

export function getDisplayName(my: MonthYear): string {
  const date = new Date(my.year, my.month - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function getStartOfMonthTimestamp(my: MonthYear): number {
  return new Date(my.year, my.month - 1, 1, 0, 0, 0, 0).getTime();
}

export function getEndOfMonthTimestamp(my: MonthYear): number {
  // Day 0 of next month is last day of current month
  return new Date(my.year, my.month, 0, 23, 59, 59, 999).getTime();
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatShortDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function getMonthYearFromTimestamp(timestamp: number): MonthYear {
  const d = new Date(timestamp);
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
  };
}

export function toInputDateFormat(timestamp: number): string {
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function fromInputDateFormat(dateStr: string): number {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0).getTime();
}
