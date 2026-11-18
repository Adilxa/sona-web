import { SeriesDetailsPage } from "@/_pages/series-details";

function positive(value?: string | string[]) {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return 0;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : 0;
}

export default async function Page({ params, searchParams }: PageProps<"/series/[slug]">) {
  const [{ slug }, { episode, at, play }] = await Promise.all([params, searchParams]);
  return <SeriesDetailsPage key={slug} id={slug} autoStart={play === "1"} episode={positive(episode)} at={positive(at)} />;
}
