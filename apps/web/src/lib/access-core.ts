/** Чистые capabilities без Next.js/БД — покрываются unit-тестами. */
export type Capability =
  | "account:self"
  | "feedback:create"
  | "feedback:read"
  | "feedback:write"
  | "metrics:read"
  | "users:read"
  | "users:manage"
  | "source-review:moderate"
  | "audit:read";

const OWNER_CAPABILITIES: Capability[] = [
  "account:self",
  "feedback:create",
  "feedback:read",
  "feedback:write",
  "metrics:read",
  "users:read",
  "users:manage",
  "source-review:moderate",
  "audit:read",
];

const USER_CAPABILITIES: Capability[] = ["account:self", "feedback:create"];

export function capabilitiesForOwner(isOwner: boolean): Capability[] {
  return isOwner ? [...OWNER_CAPABILITIES] : [...USER_CAPABILITIES];
}
