import { apiError, missingKey, upstreamError } from "@/lib/api";
import { getDepartures } from "@/lib/trafiklab";

export async function GET(_request: Request, ctx: RouteContext<"/api/departures/[id]">) {
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) return apiError("Okänd hållplats.", 400);
  if (!process.env.TRAFIKLAB_REALTIME_KEY) return missingKey("TRAFIKLAB_REALTIME_KEY");

  try {
    return Response.json(await getDepartures(id));
  } catch (error) {
    return upstreamError(error, "Kunde inte hämta avgångar just nu.");
  }
}
