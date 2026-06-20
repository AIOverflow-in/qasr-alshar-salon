import type { Locale } from "./config";

/**
 * UI dictionary. English is the complete reference; Arabic mirrors the same
 * keys (RTL). To extend Arabic coverage just fill in more strings here — the
 * whole site reads from this single object, so switching is effortless.
 */
export const DICT = {
  en: {
    nav: {
      home: "Home",
      services: "Services",
      henna: "Henna",
      packages: "Packages",
      gallery: "Gallery",
      blog: "Blog",
      about: "About",
      contact: "Contact",
      book: "Book Now",
    },
    common: {
      bookNow: "Book Now",
      bookAppointment: "Book Appointment",
      viewAll: "View All",
      viewServices: "View Services",
      whatsapp: "WhatsApp Us",
      callUs: "Call Us",
      from: "from",
      aed: "AED",
      readMore: "Read more",
      openDaily: "Open Daily · 10:00 AM – 10:00 PM",
      getDirections: "Get Directions",
      ourServices: "Our Services",
      explore: "Explore",
    },
    hero: {
      eyebrow: "Beauty Salon · Dubai",
      title: "Where Beauty Wears a Crown",
      subtitle:
        "Braiding, hair, nails, facials, makeup & henna — crafted by Dubai's finest artists at Union Metro.",
      cta: "Book Your Appointment",
      secondary: "Explore Services",
    },
    sections: {
      servicesTitle: "Signature Services",
      servicesSubtitle: "A full salon experience under one golden roof",
      whyTitle: "Why Qasr Alshar",
      hennaTitle: "Henna by Qasr",
      galleryTitle: "Our Work",
      blogTitle: "Beauty Journal",
      testimonialsTitle: "Loved by Dubai",
      locationTitle: "Visit Us",
      ctaTitle: "Ready to feel radiant?",
      ctaSubtitle: "Book your appointment in under a minute.",
    },
    footer: {
      rights: "All rights reserved.",
      quickLinks: "Quick Links",
      services: "Services",
      contact: "Contact",
      follow: "Follow Us",
      tagline: "Dubai's crown of beauty — braiding, hair, henna & more.",
    },
    booking: {
      title: "Book Your Appointment",
      subtitle: "Choose a service, pick a time, and you're all set.",
      step1: "Select Service",
      step2: "Pick Date & Time",
      step3: "Your Details",
      step4: "Confirmed",
      date: "Date",
      availableTimes: "Available Times",
      noSlots: "No slots available for this day. Please try another date.",
      name: "Full Name",
      email: "Email",
      phone: "Phone",
      notes: "Notes (optional)",
      confirm: "Confirm Booking",
      back: "Back",
      next: "Continue",
      successTitle: "Booking Confirmed!",
      successBody:
        "We've sent a confirmation to your email. We can't wait to see you at Qasr Alshar.",
    },
  },

  ar: {
    nav: {
      home: "الرئيسية",
      services: "خدماتنا",
      henna: "الحناء",
      packages: "الباقات",
      gallery: "المعرض",
      blog: "المدونة",
      about: "من نحن",
      contact: "اتصل بنا",
      book: "احجزي الآن",
    },
    common: {
      bookNow: "احجزي الآن",
      bookAppointment: "حجز موعد",
      viewAll: "عرض الكل",
      viewServices: "عرض الخدمات",
      whatsapp: "واتساب",
      callUs: "اتصلي بنا",
      from: "من",
      aed: "درهم",
      readMore: "اقرأ المزيد",
      openDaily: "مفتوح يومياً · 10 صباحاً – 10 مساءً",
      getDirections: "الاتجاهات",
      ourServices: "خدماتنا",
      explore: "استكشفي",
    },
    hero: {
      eyebrow: "صالون تجميل · دبي",
      title: "حيث يتوّج الجمال",
      subtitle:
        "ضفائر، شعر، أظافر، عناية بالبشرة، مكياج وحناء — بأيدي أمهر فنانات دبي قرب محطة الاتحاد.",
      cta: "احجزي موعدك",
      secondary: "استكشفي الخدمات",
    },
    sections: {
      servicesTitle: "خدماتنا المميزة",
      servicesSubtitle: "تجربة صالون متكاملة تحت سقف ذهبي واحد",
      whyTitle: "لماذا قصر الشار",
      hennaTitle: "الحناء من قصر",
      galleryTitle: "أعمالنا",
      blogTitle: "مدونة الجمال",
      testimonialsTitle: "محبوب في دبي",
      locationTitle: "زورونا",
      ctaTitle: "جاهزة لتتألقي؟",
      ctaSubtitle: "احجزي موعدك في أقل من دقيقة.",
    },
    footer: {
      rights: "جميع الحقوق محفوظة.",
      quickLinks: "روابط سريعة",
      services: "الخدمات",
      contact: "تواصل",
      follow: "تابعونا",
      tagline: "تاج الجمال في دبي — ضفائر، شعر، حناء والمزيد.",
    },
    booking: {
      title: "احجزي موعدك",
      subtitle: "اختاري الخدمة، حددي الوقت، وانتهى الأمر.",
      step1: "اختاري الخدمة",
      step2: "اختاري التاريخ والوقت",
      step3: "بياناتك",
      step4: "تم التأكيد",
      date: "التاريخ",
      availableTimes: "الأوقات المتاحة",
      noSlots: "لا توجد مواعيد متاحة في هذا اليوم. جرّبي تاريخاً آخر.",
      name: "الاسم الكامل",
      email: "البريد الإلكتروني",
      phone: "الهاتف",
      notes: "ملاحظات (اختياري)",
      confirm: "تأكيد الحجز",
      back: "رجوع",
      next: "متابعة",
      successTitle: "تم تأكيد الحجز!",
      successBody: "أرسلنا تأكيداً إلى بريدك. في انتظارك في قصر الشار.",
    },
  },
} as const;

export type Dictionary = (typeof DICT)["en"];

export function getDictionary(locale: Locale): Dictionary {
  return (DICT[locale] ?? DICT.en) as Dictionary;
}
