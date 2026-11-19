import { InformationPage, informationMetadata } from "@/_pages/information";

export const generateMetadata = () => informationMetadata("terms");
export default function Page() { return <InformationPage slug="terms" />; }
