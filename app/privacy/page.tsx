import { InformationPage, informationMetadata } from "@/_pages/information";

export const generateMetadata = () => informationMetadata("privacy");
export default function Page() { return <InformationPage slug="privacy" />; }
