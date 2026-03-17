import { Link } from '@tanstack/react-router';
import { ContactIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { AccountAvatarUpload } from '@/features/account/account-avatar-upload';
import { DisplayPreferences } from '@/features/account/display-preferences';
import { UserCard } from '@/features/account/user-card';
import { BuildInfoDrawer } from '@/features/build-info/build-info-drawer';
import { BuildInfoVersion } from '@/features/build-info/build-info-version';
import {
  PageLayout,
  PageLayoutContent,
  PageLayoutTopBar,
} from '@/layout/app/page-layout';

export const PageAccount = () => {
  const { t } = useTranslation(['account']);

  return (
    <PageLayout>
      <PageLayoutTopBar>
        <h1 className="text-base font-medium md:text-sm">
          {t('account:title')}
        </h1>
      </PageLayoutTopBar>
      <PageLayoutContent>
        <div className="flex flex-col gap-4">
          <UserCard />
          <Card>
            <CardHeader>
              <CardTitle>{t('account:avatar.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <AccountAvatarUpload />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t('account:personalData.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Link to="/app/account/personal-data">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  render={<span />}
                  nativeButton={false}
                >
                  <ContactIcon className="mr-1.5 size-3.5" />
                  {t('account:personalData.editButton')}
                </Button>
              </Link>
            </CardContent>
          </Card>
          <DisplayPreferences />
          <BuildInfoDrawer>
            <Button variant="ghost" size="xs" className="opacity-60">
              <BuildInfoVersion />
            </Button>
          </BuildInfoDrawer>
        </div>
      </PageLayoutContent>
    </PageLayout>
  );
};
