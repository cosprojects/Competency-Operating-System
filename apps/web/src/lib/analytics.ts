import { cookies } from "next/headers";
import { getCurrentUser } from "./auth";
import { getDb } from "./db";
import { ANON_COOKIE, CONSENT_COOKIE, sanitizeEventProps, type EventName } from "./validation";

export interface TrackedEvent {
  name: EventName;
  props?: Record<string, string | number | boolean>;
  path?: string;
  userId?: string;
}

export async function trackServerEvent(event: TrackedEvent): Promise<void> {
  try {
    const store = await cookies();
    if (store.get(CONSENT_COOKIE)?.value !== "all") return;
    const user = await getCurrentUser();
    const anonId = store.get(ANON_COOKIE)?.value ?? null;
    const db = getDb();
    await db.analyticsEvent.create({
      data: {
        name: event.name,
        anonId,
        userId: event.userId ?? user?.id ?? null,
        path: event.path ?? null,
        props: sanitizeEventProps(event.props) ?? undefined,
      },
    });
  } catch (error) {
    console.error("analytics: не удалось записать событие", error instanceof Error ? error.message : error);
  }
}
