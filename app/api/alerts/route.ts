import { alertsConfigured, cancelAlert, createAlert, type Alert } from "@/lib/alerts";
import { apiError } from "@/lib/api";

const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

function isSubscription(value: unknown): value is Alert["subscription"] {
  const s = value as Alert["subscription"] | null;
  return (
    typeof s?.endpoint === "string" &&
    s.endpoint.startsWith("https://") &&
    typeof s.keys?.p256dh === "string" &&
    typeof s.keys?.auth === "string"
  );
}

// Creates a "leave now" reminder for the first bus or train of a trip.
export async function POST(request: Request) {
  const problem = alertsConfigured();
  if (problem) return apiError(problem, 503);

  const body = (await request.json().catch(() => null)) as Partial<Alert> | null;
  if (
    !body ||
    !isSubscription(body.subscription) ||
    !/^\d+$/.test(body.stopId ?? "") ||
    !body.line ||
    !TIME.test(body.scheduledDeparture ?? "") ||
    typeof body.leadMinutes !== "number" ||
    body.leadMinutes < 0 ||
    body.leadMinutes > 60
  ) {
    return apiError("Ogiltig påminnelse.", 400);
  }

  const alert: Alert = {
    id: crypto.randomUUID(),
    subscription: body.subscription,
    stopId: body.stopId!,
    stopName: String(body.stopName ?? "hållplatsen").slice(0, 80),
    line: String(body.line).slice(0, 10),
    scheduledDeparture: body.scheduledDeparture!,
    leadMinutes: Math.round(body.leadMinutes),
    destination: String(body.destination ?? "").slice(0, 80),
  };
  try {
    await createAlert(alert);
    return Response.json({ id: alert.id });
  } catch (error) {
    console.error(error);
    return apiError("Kunde inte skapa påminnelsen.", 502);
  }
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(id)) return apiError("Okänd påminnelse.", 400);
  try {
    await cancelAlert(id);
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error(error);
    return apiError("Kunde inte ta bort påminnelsen.", 502);
  }
}
