const STABLE_MONTH_NAMES_EN_US = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export function formatStableDateTime(value: Date): string {
  if (Number.isNaN(value.getTime())) {
    return "Invalid date";
  }

  const month = STABLE_MONTH_NAMES_EN_US[value.getUTCMonth()];
  const day = value.getUTCDate();
  const year = value.getUTCFullYear();
  const hour24 = value.getUTCHours();
  const hour12 = hour24 % 12 || 12;
  const minute = value.getUTCMinutes().toString().padStart(2, "0");
  const period = hour24 >= 12 ? "PM" : "AM";

  return `${month} ${day}, ${year}, ${hour12}:${minute} ${period} UTC`;
}
