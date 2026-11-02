import { pwaIcon } from "@/lib/pwa-icon";

export const dynamic = "force-static";
export function generateStaticParams() {
  return [{ size: "192" }, { size: "512" }];
}

export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  return pwaIcon(size === "512" ? 512 : 192);
}
