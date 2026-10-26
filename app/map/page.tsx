import type { Metadata } from "next";
import { LiveMap } from "@/components/LiveMap";

export const metadata: Metadata = { title: "Karta" };

export default function MapPage() {
  return <LiveMap />;
}
