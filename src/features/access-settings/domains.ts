// Email domains that new accounts and invitations may use. An empty list
// allows any domain; a domain allows only itself, not its subdomains.

const LABEL = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export const normalizeDomain = (value: string) =>
  value.trim().toLowerCase().replace(/^@/, '');

export const isValidDomain = (value: string) => {
  const labels = value.split('.');
  return (
    value.length <= 253 &&
    labels.length >= 2 &&
    labels.every((label) => label.length <= 63 && LABEL.test(label)) &&
    /^[a-z]{2,}$/.test(labels.at(-1) ?? '')
  );
};

// "a.com, @b.org\nc.net" → ["a.com", "b.org", "c.net"]
export const parseDomainList = (value: string) => [
  ...new Set(
    value
      .split(/[\s,;]+/)
      .map(normalizeDomain)
      .filter(Boolean)
  ),
];

export const emailDomain = (email: string) =>
  email.trim().toLowerCase().split('@').at(-1) ?? '';

export const isEmailDomainAllowed = (email: string, domains: string[]) =>
  !domains.length || domains.includes(emailDomain(email));
