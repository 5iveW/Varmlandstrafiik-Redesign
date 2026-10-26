import { Receiver } from "@upstash/qstash";
import { checkAlert, type Alert } from "@/lib/alerts";
import { apiError } from "@/lib/api";

// Called by QStash when a reminder is due. Only QStash may call it: the request
// must carry a valid signature, since the body includes a push subscription.
export async function POST(request: Request) {
  const current = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const next = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (!current || !next) return apiError("QStash är inte inställt.", 503);

  const body = await request.text();
  const receiver = new Receiver({ currentSigningKey: current, nextSigningKey: next });
  const valid = await receiver
    .verify({ signature: request.headers.get("upstash-signature") ?? "", body, clockTolerance: 5 })
    .catch(() => false);
  if (!valid) return apiError("Ogiltig signatur.", 401);

  await checkAlert(JSON.parse(body) as Alert);
  return new Response(null, { status: 204 });
}
