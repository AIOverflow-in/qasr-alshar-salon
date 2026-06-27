"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Receipt } from "lucide-react";
import { setBookingStatus } from "@/lib/actions/admin";
import type { BookingStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

const STATUSES: BookingStatus[] = ["CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"];
const color: Record<string, string> = {
  CONFIRMED: "text-gold",
  COMPLETED: "text-green-400",
  CANCELLED: "text-red-400",
  NO_SHOW: "text-muted",
};

export function BookingRow({
  id,
  when,
  name,
  phone,
  email,
  service,
  price,
  notes,
  status,
}: {
  id: string;
  when: string;
  name: string;
  phone: string;
  email: string;
  service: string;
  price: string;
  notes: string | null;
  status: BookingStatus;
}) {
  const [current, setCurrent] = useState<BookingStatus>(status);
  const [pending, start] = useTransition();

  function change(next: BookingStatus) {
    setCurrent(next);
    start(() => setBookingStatus(id, next));
  }

  return (
    <tr className={cn(pending && "opacity-60")}>
      <td className="p-4 text-gold">{when}</td>
      <td className="p-4">
        <div className="text-cream">{name}</div>
        <div className="text-xs text-muted">
          <a href={`tel:${phone}`} className="hover:text-gold">{phone}</a> ·{" "}
          <a href={`mailto:${email}`} className="hover:text-gold">{email}</a>
        </div>
        {notes && <div className="mt-1 text-xs italic text-muted">“{notes}”</div>}
      </td>
      <td className="p-4 text-sand">{service}</td>
      <td className="p-4 text-cream">{price}</td>
      <td className="p-4">
        <div className="flex items-center gap-2">
          <select
            value={current}
            onChange={(e) => change(e.target.value as BookingStatus)}
            className={cn(
              "rounded-lg border border-ink-line bg-ink-card px-2.5 py-1.5 text-xs outline-none focus:border-gold/60",
              color[current]
            )}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s} className="bg-ink text-cream">
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
          {(current === "COMPLETED" || current === "CONFIRMED") && (
            <Link
              href={`/erp/pos?bookingId=${id}`}
              className="inline-flex items-center gap-1 rounded-lg border border-gold/40 px-2.5 py-1.5 text-xs text-gold hover:bg-gold/10"
              title="Generate bill for this booking"
            >
              <Receipt size={13} /> Bill
            </Link>
          )}
        </div>
      </td>
    </tr>
  );
}
