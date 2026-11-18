export function checkoutProducts(): Record<string, string> {
  const raw: unknown = JSON.parse(process.env.SONA_WEB_PRODUCT_IDS ?? "{}");
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw Error("Invalid SONA_WEB_PRODUCT_IDS");
  return Object.fromEntries(
    Object.entries(raw).filter(
      ([, id]) => typeof id === "string" && /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(id),
    ),
  );
}
