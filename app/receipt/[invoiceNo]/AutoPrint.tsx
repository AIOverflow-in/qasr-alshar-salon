"use client";

import { useEffect } from "react";
import { Printer, FileText, X } from "lucide-react";

/** Auto-opens the print dialog for the thermal receipt, and offers the two manual options the
 *  reception asked for — Print Receipt (this 80mm page) and Print A4 (the full invoice PDF). */
export function AutoPrint({ invoiceNo }: { invoiceNo: string }) {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="no-print" style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", padding: "12px 0" }}>
      <button
        onClick={() => window.print()}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 999, border: 0, background: "#8a6a1e", color: "#fff", fontWeight: 600, cursor: "pointer" }}
      >
        <Printer size={15} /> Print Receipt
      </button>
      <a
        href={`/api/erp/invoice/${invoiceNo}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 999, border: "1px solid #8a6a1e", background: "#fff", color: "#8a6a1e", fontWeight: 600, cursor: "pointer", textDecoration: "none" }}
      >
        <FileText size={15} /> Print A4
      </a>
      <button
        onClick={() => window.close()}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 999, border: "1px solid #ccc", background: "#fff", color: "#333", cursor: "pointer" }}
      >
        <X size={15} /> Close
      </button>
    </div>
  );
}
