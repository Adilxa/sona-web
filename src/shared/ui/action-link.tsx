"use client";

import { Button } from "@animate-ui/react/primitives/buttons/button";
import Link from "next/link";
import type { ComponentProps } from "react";

export function ActionLink(props: ComponentProps<typeof Link>) {
  return <Button asChild><Link {...props} /></Button>;
}
