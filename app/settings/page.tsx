import { pageMetadata } from "@/shared/i18n/server";
import { AccountPage } from "@/_pages/account";

export const generateMetadata = pageMetadata("Настройки профиля", "Profile settings");
export default function Page() { return <AccountPage area="settings" />; }
