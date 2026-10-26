import { missingKey, upstreamError } from "@/lib/api";
import { searchStops } from "@/lib/trafiklab";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return Response.json([]);
  if (!process.env.TRAFIKLAB_REALTIME_KEY) return missingKey("TRAFIKLAB_REALTIME_KEY");

  try {
    return Response.json(await searchStops(query.toLowerCase()));
  } catch (error) {
    return upstreamError(error, "Kunde inte söka hållplatser just nu.");
  }
}
