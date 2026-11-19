import { pageMetadata } from "@/shared/i18n/server";
import { ProfilePage } from "@/_pages/profile";

export const generateMetadata = pageMetadata("Профиль", "Profile");
export default function Page() { return <ProfilePage />; }
