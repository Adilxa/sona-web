import "server-only";
import { requestSona } from "@/shared/api/sona.server";
import { createCatalogReader } from "./catalog-reader";

export type { PublicSeries, PublicSeriesBrief } from "./catalog-reader";

// One server-side installation for this site, independent of visitor sessions and locale.
// Deployments sharing an API can set a distinct UUID per site via SONA_CATALOG_DEVICE_ID.
const deviceId = process.env.SONA_CATALOG_DEVICE_ID || "0a79aa02-ecac-4791-8b21-95a775766ac2";
const processState = globalThis as typeof globalThis & { sonaPublicCatalogReader?: ReturnType<typeof createCatalogReader> };
const reader = processState.sonaPublicCatalogReader?.getPublicTermName
  ? processState.sonaPublicCatalogReader
  : (processState.sonaPublicCatalogReader = createCatalogReader(requestSona, deviceId));
export const { getPublicSeries, getPublicCatalog, getPublicCatalogPage, getPublicTermName } = reader;
