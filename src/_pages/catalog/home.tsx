import { Suspense } from "react";
import { EmbeddedCatalogFallback } from "./ui/catalog-page";
import { PublicCatalog } from "./ui/public-catalog";
import { HomeBlocks } from "./ui/home-blocks";
import { ScreeningRoom } from "./ui/studio-intro";
import { MoodShelf } from "./ui/mood-shelf";
import styles from "./ui/home.module.css";

export function HomePage() {
  return <div data-view="home">
    <ScreeningRoom />
    <div className={styles.library}>
      <MoodShelf />
      <HomeBlocks />
      <Suspense fallback={<EmbeddedCatalogFallback />}>
        <PublicCatalog embedded />
      </Suspense>
    </div>
  </div>;
}
