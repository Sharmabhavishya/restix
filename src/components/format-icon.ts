import { Coins, IdCard, Mail, QrCode, Ribbon, Shapes, Smartphone, Ticket, type LucideIcon } from "lucide-react";
import type { TicketFormat } from "@/lib/listing-rules";

/** One icon per kind of ticket, shared by the sell form and the landing showcase. */
export const FORMAT_ICON: Record<TicketFormat, LucideIcon> = {
  wristband: Ribbon, paper: Ticket, qr: QrCode, email: Mail, app: Smartphone, pass: IdCard, token: Coins, other: Shapes,
};
