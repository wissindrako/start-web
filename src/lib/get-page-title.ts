import { getEnvHintTitlePrefix } from '@/features/devtools/env-hint';

export const getPageTitle = (pageTitle?: string) =>
  pageTitle
    ? `${getEnvHintTitlePrefix()} ${pageTitle} | FlyNow Admin`
    : `${getEnvHintTitlePrefix()} FlyNow Admin`;
