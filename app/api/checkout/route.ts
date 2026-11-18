import { NextRequest } from "next/server";
import { checkoutProducts } from "@/shared/api/products.server";
import { requestSona } from "@/shared/api/sona.server";
import { sameOrigin, relay } from "@/shared/api/session.server";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  const token = request.cookies.get("sona_access")?.value;
  if (!token) return new Response(null, { status: 401 });
  const body = await request.json().catch(() => null);
  const products = checkoutProducts();
  if (!body || typeof body.sku !== "string" || !Object.hasOwn(products, body.sku))
    return new Response(null, { status: 400 });
  try {
    return relay(
      await requestSona("/v1/payments/stripe/checkout", {
        method: "POST",
        accessToken: token,
        idempotencyKey: request.headers.get("Idempotency-Key") ?? undefined,
        body: { product_id: products[body.sku] },
      }),
    );
  } catch {
    return new Response(null, { status: 502 });
  }
}
