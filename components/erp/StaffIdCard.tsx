import { IdCard, ExternalLink } from "lucide-react";

// Read-only display of a staff member's HR / compliance identifiers.
// Sensitive PII — the page only renders this for SUPER_ADMIN.

export type StaffIds = {
  phone: string | null;
  passportNumber: string | null;
  passportExpiry: string | null;
  emiratesId: string | null;
  emiratesIdExpiry: string | null;
  labourPermitNumber: string | null;
  labourCardNumber: string | null;
  emergencyContact: string | null;
  emergencyRelationship: string | null;
  passportPicLink: string | null;
};

function Field({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted">{label}</dt>
      <dd className={value ? (mono ? "mt-0.5 font-mono text-sm text-cream" : "mt-0.5 text-sm text-cream") : "mt-0.5 text-sm text-muted"}>
        {value || "—"}
      </dd>
    </div>
  );
}

export function StaffIdCard({ ids }: { ids: StaffIds }) {
  const emergency = [ids.emergencyContact, ids.emergencyRelationship ? `(${ids.emergencyRelationship})` : null].filter(Boolean).join(" ") || null;
  const hasAny = Object.values(ids).some(Boolean);

  return (
    <div className="surface rounded-2xl p-5">
      <div className="flex items-center gap-2 text-sm font-medium text-cream">
        <IdCard size={16} className="text-gold" /> Identity &amp; compliance
        <span className="ml-auto rounded-full border border-ink-line px-2 py-0.5 text-[0.6rem] uppercase tracking-wider text-muted">Super Admin only</span>
      </div>
      {hasAny ? (
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-3">
          <Field label="Phone" value={ids.phone} mono />
          <Field label="Passport no." value={ids.passportNumber} mono />
          <Field label="Passport expiry" value={ids.passportExpiry} />
          <Field label="Emirates ID" value={ids.emiratesId} mono />
          <Field label="Emirates ID expiry" value={ids.emiratesIdExpiry} />
          <Field label="Labour permit no." value={ids.labourPermitNumber} mono />
          <Field label="Labour card no." value={ids.labourCardNumber} mono />
          <Field label="Emergency contact" value={emergency} />
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted">Passport scan</dt>
            <dd className="mt-0.5 text-sm">
              {ids.passportPicLink ? (
                <a href={ids.passportPicLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-gold hover:underline">
                  Open <ExternalLink size={12} />
                </a>
              ) : (
                <span className="text-muted">—</span>
              )}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="mt-3 text-sm text-muted">No identity records on file yet.</p>
      )}
    </div>
  );
}
