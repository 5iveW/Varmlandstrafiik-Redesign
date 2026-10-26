import { apiError, missingKey, upstreamError } from "@/lib/api";
import { searchLiveTrips } from "@/lib/live-trips";

// A stop id, or "lat,lon" for the user's position.
const PLACE = /^(\d+|-?\d{1,3}\.\d+,-?\d{1,3}\.\d+)$/;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const date = params.get("date") ?? undefined;
  const time = params.get("time") ?? undefined;
  const page = params.get("page") ?? undefined;

  if (!PLACE.test(from) || !PLACE.test(to)) return apiError("Välj både från och till.", 400);
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return apiError("Ogiltigt datum.", 400);
  if (time && !/^\d{2}:\d{2}$/.test(time)) return apiError("Ogiltig tid.", 400);
  if (!process.env.RESROBOT_KEY) return missingKey("RESROBOT_KEY");

  try {
    return Response.json(await searchLiveTrips({ from, to, date, time, page }));
  } catch (error) {
    return upstreamError(error, "Kunde inte söka resor just nu.");
  }
}
