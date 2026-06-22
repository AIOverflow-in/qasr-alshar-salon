import Link from "next/link";
import { MapPin, Phone, Clock } from "lucide-react";
import { Logo } from "./Logo";
import { InstagramIcon, TikTokIcon, FacebookIcon, SnapchatIcon, GoogleIcon } from "./icons";
import { SITE } from "@/lib/site";
import { CATEGORIES } from "@/lib/services";
import { getI18n } from "@/lib/i18n/server";
import { whatsappLink } from "@/lib/utils";

export async function Footer() {
  const { t } = await getI18n();
  const year = 2026;

  return (
    <footer className="relative mt-auto border-t border-ink-line bg-ink-soft">
      <div className="container-x grid gap-12 py-16 md:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-1">
          <Logo />
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-muted">
            {t.footer.tagline}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {[
              { href: SITE.social.instagram, label: "Instagram", icon: <InstagramIcon size={18} /> },
              { href: SITE.social.tiktok, label: "TikTok", icon: <TikTokIcon size={18} /> },
              { href: SITE.social.facebook, label: "Facebook", icon: <FacebookIcon size={18} /> },
              { href: SITE.social.snapchat, label: "Snapchat", icon: <SnapchatIcon size={18} /> },
              { href: SITE.social.googleBusiness, label: "Google", icon: <GoogleIcon size={18} /> },
            ].map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                className="grid h-10 w-10 place-items-center rounded-full border border-ink-line text-sand transition-colors hover:border-gold hover:text-gold"
              >
                {s.icon}
              </a>
            ))}
          </div>
        </div>

        <div>
          <h4 className="mb-5 font-display text-lg text-gold">{t.footer.quickLinks}</h4>
          <ul className="space-y-3 text-sm text-sand">
            {[
              { href: "/services", label: t.nav.services },
              { href: "/henna", label: t.nav.henna },
              { href: "/packages", label: t.nav.packages },
              { href: "/gallery", label: t.nav.gallery },
              { href: "/blog", label: t.nav.blog },
              { href: "/book", label: t.nav.book },
            ].map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="transition-colors hover:text-gold">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="mb-5 font-display text-lg text-gold">{t.footer.services}</h4>
          <ul className="space-y-3 text-sm text-sand">
            {CATEGORIES.slice(0, 6).map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/services/${c.slug}`}
                  className="transition-colors hover:text-gold"
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="mb-5 font-display text-lg text-gold">{t.footer.contact}</h4>
          <ul className="space-y-4 text-sm text-sand">
            <li className="flex gap-3">
              <MapPin size={18} className="mt-0.5 shrink-0 text-gold" />
              <span>
                {SITE.address.line1}, {SITE.address.city}, {SITE.address.country}
              </span>
            </li>
            <li className="flex gap-3">
              <Phone size={18} className="mt-0.5 shrink-0 text-gold" />
              <a href={`tel:${SITE.phones[0].value}`} className="hover:text-gold">
                {SITE.phones[0].label}
              </a>
            </li>
            <li className="flex gap-3">
              <Clock size={18} className="mt-0.5 shrink-0 text-gold" />
              <span>{t.common.openDaily}</span>
            </li>
            <li>
              <a
                href={whatsappLink(SITE.whatsapp, "Hi Qasr Alshar! I'd like to book an appointment.")}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-gold/40 px-4 py-2 text-gold transition-colors hover:bg-gold/10"
              >
                {t.common.whatsapp}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-ink-line">
        <div className="container-x flex flex-col items-center justify-between gap-3 py-6 text-xs text-muted md:flex-row">
          <p>
            © {year} {SITE.name}. {t.footer.rights}
          </p>
          <p className="text-muted/70">Made with care in Dubai · UAE</p>
        </div>
      </div>
    </footer>
  );
}
