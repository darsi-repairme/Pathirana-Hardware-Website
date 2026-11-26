/**
 * Website languages. English is the default and the source text; Tamil and
 * Sinhala translations live in ./messages (keyed by the English text, so a
 * missing translation always falls back to the real English wording — never
 * to a placeholder key).
 *
 * Kept free of imports so unit tests and the inline pre-hydration script can use it.
 */
export const LOCALES = ["en", "ta", "si"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_META: Record<Locale, { short: string; native: string; english: string; htmlLang: string }> = {
  en: { short: "EN", native: "English", english: "English", htmlLang: "en-LK" },
  ta: { short: "தமிழ்", native: "தமிழ்", english: "Tamil", htmlLang: "ta-LK" },
  si: { short: "සිංහල", native: "සිංහල", english: "Sinhala", htmlLang: "si-LK" },
};

/** localStorage key holding the visitor's chosen language. */
export const LOCALE_STORAGE_KEY = "ph-lang";
/** Optional ?lang=ta|si|en on any URL (shareable links); it is then remembered. */
export const LOCALE_QUERY_PARAM = "lang";

export const isLocale = (v: unknown): v is Locale =>
  typeof v === "string" && (LOCALES as readonly string[]).includes(v);

/**
 * Runs in <head> before the page is painted: applies the remembered language
 * to <html lang> and, for Tamil / Sinhala, hides the (English) server-rendered
 * text until React has swapped it — so visitors never see a flash of English.
 * A timer always reveals the page, even if scripts fail.
 */
export const LOCALE_BOOT_SCRIPT = `try{var d=document.documentElement,k=${JSON.stringify(LOCALE_STORAGE_KEY)},m=${JSON.stringify(
  Object.fromEntries(LOCALES.map((l) => [l, LOCALE_META[l].htmlLang])),
)},q=new URLSearchParams(location.search).get(${JSON.stringify(LOCALE_QUERY_PARAM)}),s=null;try{s=localStorage.getItem(k)}catch(e){}var l=m[q]?q:m[s]?s:"en";if(m[q])try{localStorage.setItem(k,q)}catch(e){}d.lang=m[l];d.setAttribute("data-locale",l);if(l!=="en"){d.classList.add("i18n-pending");setTimeout(function(){d.classList.remove("i18n-pending")},1800)}}catch(e){}`;
