import type { components } from "@/shared/api/schema";

type Status = components["schemas"]["CheckinStatus"];
type Receipt = components["schemas"]["CheckinResult"];

// The API includes previous cycles in days. Only its newest, consecutive prefix belongs to this cycle.
export function checkinCycle(today: Status, receipt?: Receipt) {
  const day = receipt?.day_index ?? today.current_day_index;
  const checked = today.today_checked_in || Boolean(receipt);
  const marked = new Set<number>();
  let expected = today.today_checked_in ? today.current_day_index : today.current_day_index - 1;
  for (const record of day === today.current_day_index ? today.days : []) {
    if (expected < 1 || record.day_index !== expected) break;
    marked.add(record.day_index);
    expected--;
  }
  if (checked) marked.add(day);
  const awarded = receipt && !receipt.already_checked_in && receipt.reward_coins > 0 ? receipt.reward_coins : undefined;
  return { day, checked, marked, awarded };
}
