import { InformationPage, informationMetadata } from "@/_pages/information";

export const generateMetadata = () => informationMetadata("help");
export default function Page() { return <InformationPage slug="help" />; }
