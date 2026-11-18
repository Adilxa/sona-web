import type { SVGProps } from "react";

// Wide counters and blunt terminals repeat the shapes of the Unbounded wordmark.
const paths = {
  home: "M2.4 10.1 10.9 3.2a1.8 1.8 0 0 1 2.2 0l8.5 6.9v10.7h-7.5v-6.7H9.9v6.7H2.4Z",
  feed: "M7.6 2h11.1a2.1 2.1 0 0 1 2.1 2.1v13.3a2.1 2.1 0 0 1-2.1 2.1H7.6a2.1 2.1 0 0 1-2.1-2.1V4.1A2.1 2.1 0 0 1 7.6 2Zm3.2 5.2v7.2l6-3.6ZM2.3 5.7h1.8v12.2a3.1 3.1 0 0 0 3.1 3.1h9.9v1.7H7.2a4.9 4.9 0 0 1-4.9-4.8Z",
  film: "M2 3.9h20v16.2H2Zm5.8 3v10.2h8.4V6.9Zm-3.7 0v2.4h1.8V6.9Zm14 0v2.4h1.8V6.9Zm-14 6.9v2.5h1.8v-2.5Zm14 0v2.5h1.8v-2.5Z",
  bookmark: "M4.3 3.1h15.4v18.5l-7.7-4.4-7.7 4.4Zm3 3v10.5l4.7-2.7 4.7 2.7V6.1Z",
  history: "M3.1 3.6h2.7v2.7A9.5 9.5 0 1 1 3 14h3a6.6 6.6 0 1 0 1.5-6.2h2.9v2.7H3.1ZM10.8 8.8h2.5v3l3.1 1.8-1.2 2.1-4.4-2.5Z",
  profile: "M12 2.6c3 0 5.1 1.8 5.1 4.6s-2.1 4.7-5.1 4.7-5.1-1.9-5.1-4.7S9 2.6 12 2.6Zm0 10.9c5.9 0 9.1 2.6 9.1 6.1v1.2H2.9v-1.2c0-3.5 3.2-6.1 9.1-6.1Z",
  search: "M10.5 2.9c5 0 8.3 2.9 8.3 7.2a7 7 0 0 1-1.7 4.7l5.3 4.9-2 2.1-5.8-5.2a9.9 9.9 0 0 1-4.1.8c-5 0-8.4-3-8.4-7.3s3.4-7.2 8.4-7.2Zm0 2.9C7.2 5.8 5 7.5 5 10.1s2.2 4.4 5.5 4.4 5.4-1.7 5.4-4.4-2.1-4.3-5.4-4.3Z",
  chevron: "M2.9 8.4 5 6.3l7 7 7-7 2.1 2.1-9.1 9.2Z",
  close: "m5.3 3.4 6.7 6.7 6.7-6.7 1.9 1.9-6.7 6.7 6.7 6.7-1.9 1.9-6.7-6.7-6.7 6.7-1.9-1.9 6.7-6.7-6.7-6.7Z",
  arrow: "m13.4 3.1 8.8 8.9-8.8 8.9-2.1-2.1 5.4-5.4H2.5v-2.8h14.2l-5.4-5.4Z",
};

export type BrandIconName = keyof typeof paths;

type BrandIconProps = Omit<SVGProps<SVGSVGElement>, "name"> & { name: BrandIconName; size?: number | string };

export function BrandIcon({ name, size = 20, ...props }: BrandIconProps) {
  return <svg viewBox="0 0 24 24" width={size} height={size} focusable="false" aria-hidden="true" {...props}>
    <path d={paths[name]} fill="currentColor" fillRule="evenodd" />
  </svg>;
}
