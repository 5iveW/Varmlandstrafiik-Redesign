import { apiError, missingKey, upstreamError } from "@/lib/api";
import { nearbyStops } from "@/lib/resrobot";

const COORD = /^-?\d{1,3}\.\d+$/;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const lat = params.get("lat") ?? "";
  const lon = params.get("lon") ?? "";
  if (!COORD.test(lat) || !COORD.test(lon)) return apiError("Ogiltig position.", 400);
  if (!process.env.RESROBOT_KEY) return missingKey("RESROBOT_KEY");

  try {
    // Rounded to about 100 m so nearby requests share the server cache.
    return Response.json(await nearbyStops(Number(lat).toFixed(3), Number(lon).toFixed(3)));
  } catch (error) {
    return upstreamError(error, "Kunde inte hitta hållplatser nära dig.");
  }
}
