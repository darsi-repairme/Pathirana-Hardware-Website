import type { Messages } from "./index.ts";

/**
 * Header Offers panel, the menu's language section and the quotation promo-code field (2026-11-21).
 * REVIEW: to be checked by native Tamil and Sinhala speakers before launch.
 */
export const offers: Messages = {
  // Header offers button and panel
  Offers: ["சலுகைகள்", "දීමනා"],
  "Special offers and promo codes": ["சிறப்புச் சலுகைகளும் சலுகைக் குறியீடுகளும்", "විශේෂ දීමනා සහ ප්‍රවර්ධන කේත"],
  "Special offers": ["சிறப்புச் சலுகைகள்", "විශේෂ දීමනා"],
  "Close offers": ["சலுகைகளை மூடு", "දීමනා වසන්න"],
  "Loading offers…": ["சலுகைகள் ஏற்றப்படுகின்றன…", "දීමනා පූරණය වෙමින්…"],
  "Offers could not be loaded. Please try again.": [
    "சலுகைகளை ஏற்ற முடியவில்லை. மீண்டும் முயற்சிக்கவும்.",
    "දීමනා පූරණය කළ නොහැකි විය. කරුණාකර නැවත උත්සාහ කරන්න.",
  ],
  "No special offers are available at the moment.": [
    "தற்போது சிறப்புச் சலுகைகள் எதுவும் இல்லை.",
    "මේ මොහොතේ විශේෂ දීමනා කිසිවක් නොමැත.",
  ],
  "Promo code": ["சலுகைக் குறியீடு", "ප්‍රවර්ධන කේතය"],
  "Copy code": ["குறியீட்டை நகலெடு", "කේතය පිටපත් කරන්න"],
  Copied: ["நகலெடுக்கப்பட்டது", "පිටපත් කළා"],
  "Promo code {code} copied.": ["சலுகைக் குறியீடு {code} நகலெடுக்கப்பட்டது.", "ප්‍රවර්ධන කේතය {code} පිටපත් කළා."],
  "Valid until {date}": ["{date} வரை செல்லுபடியாகும்", "{date} දක්වා වලංගුයි"],
  "Minimum purchase: {amount}": ["குறைந்தபட்ச கொள்முதல்: {amount}", "අවම මිලදී ගැනීම: {amount}"],
  "Applies to:": ["பொருந்துவது:", "අදාළ වන්නේ:"],
  "{value}% off": ["{value}% தள்ளுபடி", "{value}% වට්ටම්"],
  "{amount} off": ["{amount} தள்ளுபடி", "{amount} වට්ටම්"],
  "Prices, stock and the offer are confirmed by our staff when you request a quotation.": [
    "நீங்கள் விலைக்கூறல் கோரும்போது விலைகள், இருப்பு மற்றும் சலுகையை எமது ஊழியர்கள் உறுதிப்படுத்துவார்கள்.",
    "ඔබ මිල ගණනක් ඉල්ලූ විට මිල, තොගය සහ දීමනාව අපගේ කාර්ය මණ්ඩලය තහවුරු කරයි.",
  ],
  // Quotation form
  "If you have a code from our offers, enter it here. Our staff confirm the offer and final price.": [
    "எமது சலுகைகளிலிருந்து குறியீடு இருந்தால், அதை இங்கே உள்ளிடவும். சலுகையையும் இறுதி விலையையும் எமது ஊழியர்கள் உறுதிப்படுத்துவார்கள்.",
    "අපගේ දීමනාවලින් ලැබුණු කේතයක් ඇත්නම්, එය මෙහි ඇතුළත් කරන්න. දීමනාව සහ අවසාන මිල අපගේ කාර්ය මණ්ඩලය තහවුරු කරයි.",
  ],
  "A promo code has only letters, digits and hyphens.": [
    "சலுகைக் குறியீட்டில் எழுத்துகள், இலக்கங்கள் மற்றும் இணைப்புக்கோடுகள் மட்டுமே இருக்கும்.",
    "ප්‍රවර්ධන කේතයක ඇත්තේ අකුරු, ඉලක්කම් සහ හයිෆන් පමණි.",
  ],
  "This code matches a current offer. Our staff will confirm it with your quotation.": [
    "இந்தக் குறியீடு தற்போதைய சலுகையுடன் பொருந்துகிறது. உங்கள் விலைக்கூறலுடன் எமது ஊழியர்கள் அதை உறுதிப்படுத்துவார்கள்.",
    "මෙම කේතය වත්මන් දීමනාවකට ගැළපේ. ඔබේ මිල ගණන් සමඟ අපගේ කාර්ය මණ්ඩලය එය තහවුරු කරයි.",
  ],
  "This code is for other products. You can still send the request; our staff will check it.": [
    "இந்தக் குறியீடு வேறு பொருட்களுக்கானது. நீங்கள் கோரிக்கையை அனுப்பலாம்; எமது ஊழியர்கள் சரிபார்ப்பார்கள்.",
    "මෙම කේතය වෙනත් භාණ්ඩ සඳහා ය. ඔබට තවමත් ඉල්ලීම යැවිය හැක; අපගේ කාර්ය මණ්ඩලය එය පරීක්ෂා කරයි.",
  ],
  "This offer has ended. You can still send the request without it.": [
    "இந்தச் சலுகை முடிவடைந்துவிட்டது. அது இல்லாமலே கோரிக்கையை அனுப்பலாம்.",
    "මෙම දීමනාව අවසන් වී ඇත. එය නොමැතිව ඔබට ඉල්ලීම යැවිය හැක.",
  ],
  "We could not find a current offer with this code. Please check it, or send the request without it.": [
    "இந்தக் குறியீட்டுடன் தற்போதைய சலுகை எதுவும் கிடைக்கவில்லை. அதைச் சரிபார்க்கவும், அல்லது அது இல்லாமல் கோரிக்கையை அனுப்பவும்.",
    "මෙම කේතය සහිත වත්මන් දීමනාවක් හමු නොවීය. කරුණාකර එය පරීක්ෂා කරන්න, නැතහොත් එය නොමැතිව ඉල්ලීම යවන්න.",
  ],
};
