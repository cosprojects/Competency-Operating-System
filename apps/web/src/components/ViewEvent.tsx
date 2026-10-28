"use client";

import { useEffect } from "react";
import type { EventName } from "@/lib/validation";
import { trackClient } from "@/lib/client-analytics";

export function ViewEvent({
  name,
  props,
}: {
  name: EventName;
  props?: Record<string, string | number | boolean>;
}) {
  useEffect(() => {
    trackClient(name, props);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);
  return null;
}
