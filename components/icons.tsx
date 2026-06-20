export function InstagramIcon({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

export function TikTokIcon({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M16.6 5.82a4.28 4.28 0 0 1-1-2.82h-3.2v12.86a2.6 2.6 0 1 1-2.6-2.6c.26 0 .51.04.75.11V7.1a5.86 5.86 0 1 0 5.05 5.8V9.01a7.4 7.4 0 0 0 4.35 1.4V7.2a4.28 4.28 0 0 1-3.35-1.38z" />
    </svg>
  );
}
