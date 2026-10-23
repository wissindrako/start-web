import {
  getCookie,
  getRequestHeaders,
  setCookie,
} from '@tanstack/react-start/server';

import {
  AVAILABLE_LANGUAGES,
  DEFAULT_LANGUAGE_KEY,
} from '@/lib/i18n/constants';

/**
 * Retrieves the user's language preference.
 *
 * @param {string} [input] - Optional input language key. If not provided, the function will attempt to retrieve the language from a cookie named 'i18next'.
 * @returns {string} - Returns the language key if it is available in the list of supported languages. Otherwise, returns the default language key.
 */
export const getUserLanguage = (input?: string) => {
  const value =
    input ??
    getCookie('i18next') ??
    getRequestHeaders()
      .get('accept-language')
      ?.split(',')?.[0] // Get the first language ar,en-US -> ar
      ?.split('-')?.[0]; // Get the first part en-US -> en

  const language = AVAILABLE_LANGUAGES.some((l) => l.key === value)
    ? value!
    : DEFAULT_LANGUAGE_KEY;

  setCookie('i18next', language);

  return language;
};

// Better Auth stores URI lists as JSON text on MySQL
export const parseUriList = (value: string | null | undefined): string[] => {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [value];
  } catch {
    return value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  }
};
