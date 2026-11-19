"use client";

import { useI18n } from "@/shared/i18n/context";
import { SlidingNumber } from "@animate-ui/react/primitives/texts/sliding-number";
import styles from "./wallet-rewards.module.css";

export function ConfirmedCount({ value }: { value: number }) {
  const { locale } = useI18n();
  // A text rendering lets very large balances wrap on narrow screens.
  if (Math.abs(value) >= 100_000_000) return <span className={styles.largeNumber}>{value.toLocaleString(locale)}</span>;
  return <SlidingNumber number={value} initiallyStable thousandSeparator={locale === "en" ? "," : " "} className={styles.number} />;
}
