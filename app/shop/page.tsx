import { pageMetadata } from "@/shared/i18n/server";
import { ShopPage } from "@/_pages/shop";
import { checkoutProducts } from "@/shared/api/products.server";

export const generateMetadata = pageMetadata("Пакеты монет", "Coin packs");
export const dynamic = "force-dynamic";

export default function Page() { return <ShopPage purchasable={Object.keys(checkoutProducts())} />; }
