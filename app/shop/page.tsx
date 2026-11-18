import { ShopPage } from "@/_pages/shop";
import { checkoutProducts } from "@/shared/api/products.server";

export const metadata = { title: "Пакеты монет" };
export const dynamic = "force-dynamic";

export default function Page() { return <ShopPage purchasable={Object.keys(checkoutProducts())} />; }
