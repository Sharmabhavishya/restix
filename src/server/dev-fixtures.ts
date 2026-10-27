// Development accounts seeded into the LOCAL database only (scripts/seed.ts).
// Fixed ids so dev sessions survive a reseed.
export const DEV_COLLEGE = { slug: "snu", name: "Shiv Nadar University", shortName: "SNU", domain: "snu.edu.in" };

export const DEV_USERS = [
  { id: "00000000-0000-4000-8000-000000000001", email: "asha.k@snu.edu.in", name: "Asha K", role: null },
  { id: "00000000-0000-4000-8000-000000000002", email: "rohan.m@snu.edu.in", name: "Rohan M", role: null },
  { id: "00000000-0000-4000-8000-000000000003", email: "meera.mod@snu.edu.in", name: "Meera (moderator)", role: "admin" },
] as const;
