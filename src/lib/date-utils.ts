const TZ = 'Asia/Colombo';

export const formatDate = (date: Date | string | number): string =>
  new Date(date).toLocaleDateString('en-LK', { timeZone: TZ });

export const formatDateTime = (date: Date | string | number): string =>
  new Date(date).toLocaleString('en-LK', { timeZone: TZ });

export const formatTime = (date: Date | string | number): string =>
  new Date(date).toLocaleTimeString('en-LK', { timeZone: TZ });

/** Today's date string in Sri Lanka time — safe to use on devices in any timezone */
export const todaySL = (): string => formatDate(new Date());
