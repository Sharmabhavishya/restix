import type { Metadata } from "next";
import { requireModerator } from "@/server/auth/viewer";
import { openAppeals } from "@/server/moderation";
import { relativeTime } from "@/lib/format";
import { ModForm } from "../mod-form";
import { EmptyState, Notice, PageTitle, Panel, Pill } from "@/components/ui/bits";

export const metadata: Metadata = { title: "Appeals" };

export default async function AppealsPage() {
  const mod = await requireModerator();
  const rows = await openAppeals(mod.id);
  return (
    <>
      <PageTitle title="Appeals" sub="People asking for a decision to be looked at again. Where you can, leave your own decisions to someone else." />
      {rows.length === 0 ? (
        <EmptyState title="no open appeals" />
      ) : (
        <ul className="flex flex-col gap-4">
          {rows.map((a) => {
            const own = a.actionById === mod.id;
            const self = a.userId === mod.id;
            return (
              <li key={a.id}>
                <Panel className="grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{a.userName}</span>
                      <Pill tone={a.userStatus === "active" ? "positive" : "negative"}>{a.userStatus}</Pill>
                      <span className="text-[13px] text-muted">{relativeTime(a.createdAt)}</span>
                    </div>
                    {a.actionName && (
                      <p className="mt-2 text-[13px] text-muted">
                        Appealing: {a.actionName.replace(/_/g, " ")} by {a.actionBy ?? "a moderator"}{a.actionReason ? ` (“${a.actionReason}”)` : ""}
                      </p>
                    )}
                    <p className="mt-3 text-[15px] whitespace-pre-line">{a.message}</p>
                    {own && <Notice tone="warning" className="mt-3">You made the original decision. Ask another moderator to review this if anyone else is available.</Notice>}
                  </div>
                  {self ? (
                    <p className="text-sm text-muted">This is your own appeal. Another moderator must decide it.</p>
                  ) : (
                    <ModForm
                      hidden={{ appealId: a.id }}
                      compact
                      reasonLabel="Decision note (the person sees this)"
                      ops={[
                        { op: "appeal:reversed", label: "Reverse decision", tone: "primary" },
                        { op: "appeal:upheld", label: "Uphold" },
                      ]}
                    />
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
