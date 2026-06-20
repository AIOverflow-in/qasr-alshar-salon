import { getI18n } from "@/lib/i18n/server";
import { HeaderClient } from "./HeaderClient";

export async function Header() {
  const { locale, t } = await getI18n();
  return <HeaderClient locale={locale} nav={t.nav} bookLabel={t.common.bookNow} />;
}
