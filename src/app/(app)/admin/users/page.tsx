import type { Metadata } from "next";
import { requireModerator } from "@/server/auth/viewer";
import { findUsers } from "@/server/moderation";
import { formatLongDate } from "@/lib/format";
import { ModForm, type ModOp } from "../mod-form";
import { EmptyState, PageTitle, Panel, Pill } from "@/components/ui/bits";
import { Input } from "@/components/ui/field";
import { buttonClass } from "@/components/ui/button";

export const metadata: Metadata = { title: "Accounts" };

export default async function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  const sp = await searchParams;
  const mod = await requireModerator();
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const users = await findUsers(mod.id, q);

  return (
    <>
      <PageTitle title="Accounts" sub={q ? `Matching “${q}”.` : "Accounts with a restriction or reports against them. Search to find anyone."} />
      <form method="get" className="mb-5 flex max-w-xl gap-2">
        <Input name="q" type="search" defaultValue={q} placeholder="Name or email" aria-label="Search accounts" />
        <button className={buttonClass("dark")}>Search</button>
      </form>
      {users.length === 0 ? (
        <EmptyState title={q ? "no matches" : "no flagged accounts"} />
      ) : (
        <ul className="flex flex-col gap-3">
          {users.map((u) => {
            const ops: ModOp[] = u.status === "active"
              ? [{ op: "user:restrict", label: "Restrict" }, { op: "user:suspend", label: "Suspend", tone: "danger" }]
              : [{ op: "user:reinstate", label: "Reinstate" }];
            const roleOps: ModOp[] = u.role
              ? [{ op: "role:none", label: "Remove role", tone: "danger" }, ...(u.role === "moderator" ? [{ op: "role:admin", label: "Make admin" }] : [])]
              : [{ op: "role:moderator", label: "Make moderator" }];
            return (
              <li key={u.id}>
                <Panel className="grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{u.displayName}</span>
                      <Pill tone={u.status === "active" ? "positive" : "negative"}>{u.status}</Pill>
                      {u.role && <Pill tone="accent">{u.role}</Pill>}
                    </div>
                    <p className="mt-1 text-[13px] break-all text-muted">{u.email}</p>
                    <p className="mt-2 text-[13px] text-muted">
                      Joined {formatLongDate(u.createdAt)} · <span className="num">{u.listings}</span> listings · <span className="num">{u.reportsAgainst}</span> reports against
                    </p>
                  </div>
                  {u.id === mod.id ? (
                    <p className="text-sm text-muted">That&apos;s you.</p>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {!u.role && <ModForm hidden={{ userId: u.id }} compact ops={ops} placeholder="Shown to the person" />}
                      {mod.role === "admin" && <ModForm hidden={{ userId: u.id }} compact ops={roleOps} reasonLabel="Reason for the role change" />}
                    </div>
                  )}
                </Panel>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
