import { getRequestConfig } from "next-intl/server";

export default getRequestConfig(async ({ locale }) => {
  try {
    return {
      locale,
      messages: (await import(`./messages/${locale}.json`)).default,
      timeZone: "Europe/Bucharest",
      now: new Date(),
    };
  } catch {
    // Fallback to Romanian if translation file is missing
    return {
      locale: "ro",
      messages: (await import("./messages/ro.json")).default,
      timeZone: "Europe/Bucharest",
      now: new Date(),
    };
  }
});