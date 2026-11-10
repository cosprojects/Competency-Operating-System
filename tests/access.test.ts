import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { capabilitiesForOwner } from "../apps/web/src/lib/access-core.ts";

describe("access capabilities", () => {
  it("даёт OWNER полный набор capabilities", () => {
    const caps = capabilitiesForOwner(true);
    assert.ok(caps.includes("feedback:read"));
    assert.ok(caps.includes("users:manage"));
    assert.ok(caps.includes("audit:read"));
  });

  it("не даёт обычному пользователю админ-права", () => {
    assert.deepEqual(capabilitiesForOwner(false), ["account:self", "feedback:create"]);
  });
});
