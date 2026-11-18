import { CatalogPage } from "./ui/catalog-page";
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
      <CatalogPage embedded initialCollection="catalog" title="Все сериалы" />
    </div>
  </div>;
}
