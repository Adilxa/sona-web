import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import styles from "./interior-page.module.css";

type Destination = { href: string; label: string };

export function InteriorBack({ href, label }: Destination) {
  return <Link className={styles.back} href={href}>
    <ArrowLeft size={17} strokeWidth={2} aria-hidden="true" /><span>{label}</span>
  </Link>;
}

export function InteriorPage({ title, back, description, actions, children, className, id }: {
  title: string; back: Destination; description?: ReactNode; actions?: ReactNode;
  children: ReactNode; className?: string; id?: string;
}) {
  return <section className={[styles.page, className].filter(Boolean).join(" ")} data-interior-page id={id} aria-labelledby="interior-title">
    <InteriorBack {...back} />
    <header className={styles.header}>
      <div><h1 id="interior-title">{title}</h1>{description && <div className={styles.description}>{description}</div>}</div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
    {children}
  </section>;
}
