import { connection } from "next/server";
import { missingKey, upstreamError } from "@/lib/api";
import { getVehicles } from "@/lib/gtfs";

export async function GET() {
  // Live data: never prerender this route at build time.
  await connection();
  if (!process.env.GTFS_REGIONAL_RT_KEY) return missingKey("GTFS_REGIONAL_RT_KEY");
  if (!process.env.GTFS_REGIONAL_STATIC_KEY) return missingKey("GTFS_REGIONAL_STATIC_KEY");

  try {
    return Response.json(await getVehicles());
  } catch (error) {
    return upstreamError(error, "Kunde inte hämta bussarnas positioner just nu.");
  }
}
