import { NextResponse, type NextRequest } from "next/server";
import { isLocale } from "@/shared/i18n/model";

// Make shared language-specific links deterministic, including the root layout and metadata.
export function proxy(request: NextRequest) {
  const language = request.nextUrl.searchParams.get("lang");
  const headers = new Headers(request.headers);
  headers.delete("x-sona-page-language");
  if (isLocale(language)) headers.set("x-sona-page-language", language);
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ["/", "/catalog", "/series/:segment", "/feed", "/history", "/favorites", "/profile", "/settings", "/login", "/wallet", "/rewards", "/devices", "/shop", "/privacy", "/terms", "/help"] };
