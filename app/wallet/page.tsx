import { pageMetadata } from "@/shared/i18n/server";
import { AccountPage } from "@/_pages/account";

export const generateMetadata = pageMetadata("Кошелёк", "Wallet");

export default function Page() { return <AccountPage area="wallet" />; }
