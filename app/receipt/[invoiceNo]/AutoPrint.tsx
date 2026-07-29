"use client";

import { useEffect } from "react";
import { Printer } from "lucide-react";

/** Opens the print dialog automatically once the receipt has laid out, and offers a manual
 *  Print/Close (hidden from the printed output) in case the browser blocks auto-print. */
export function AutoPrint() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="no-print" style={{ display: "flex", gap: 8, justifyContent: "center", padding: "12px 0" }}>
      <button
        onClick={() => window.print()}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 999, border: 0, background: "#8a6a1e", color: "#fff", fontWeight: 600, cursor: "pointer" }}
      >
        <Printer size={15} /> Print receipt
      </button>
      <button
        onClick={() => window.close()}
        style={{ padding: "8px 16px", borderRadius: 999, border: "1px solid #ccc", background: "#fff", color: "#333", cursor: "pointer" }}
      >
        Close
      </button>
    </div>
  );
}
