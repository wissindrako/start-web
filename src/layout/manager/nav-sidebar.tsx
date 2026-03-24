import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  LayoutDashboardIcon,
  PanelLeftIcon,
  SettingsIcon,
  ShieldIcon,
  UsersIcon,
  XIcon,
} from 'lucide-react';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { orpc } from '@/lib/orpc/client';

import { Logo } from '@/components/brand/logo';
import { IconBookOpen } from '@/components/icons/generated';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';

import { WithPermissions } from '@/features/auth/with-permission';
import { NavUser } from '@/layout/manager/nav-user';

export const NavSidebar = (props: { children?: ReactNode }) => {
  const { t } = useTranslation(['layout']);
  const systemConfigQuery = useQuery(orpc.systemConfig.get.queryOptions());
  const systemName = systemConfigQuery.data?.systemName;
  const logoUrl = systemConfigQuery.data?.logoUrl;
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="h-auto"
                  render={
                    <Link to="/manager">
                      <span>
                        {logoUrl ? (
                          <img
                            src={logoUrl}
                            alt={systemName ?? 'Logo'}
                            className="h-8 w-auto object-contain group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:object-cover"
                          />
                        ) : systemName ? (
                          <span className="truncate text-base font-semibold">
                            {systemName}
                          </span>
                        ) : (
                          <Logo className="w-24 group-data-[collapsible=icon]:w-18" />
                        )}
                      </span>
                    </Link>
                  }
                />
              </SidebarMenuItem>
            </SidebarMenu>
            <SidebarTrigger
              className="group-data-[collapsible=icon]:hidden"
              icon={
                <>
                  <XIcon className="md:hidden" />
                  <PanelLeftIcon className="hidden md:block rtl:rotate-180" />
                </>
              }
            />
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>{t('layout:nav.application')}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <Link to="/manager/dashboard">
                    {({ isActive }) => (
                      <SidebarMenuButton
                        isActive={isActive}
                        render={
                          <span>
                            <LayoutDashboardIcon />
                            <span>{t('layout:nav.dashboard')}</span>
                          </span>
                        }
                      />
                    )}
                  </Link>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <Link to="/manager/books">
                    {({ isActive }) => (
                      <SidebarMenuButton
                        isActive={isActive}
                        render={
                          <span>
                            <IconBookOpen />
                            <span>{t('layout:nav.books')}</span>
                          </span>
                        }
                      />
                    )}
                  </Link>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <WithPermissions
            permissions={[
              {
                user: ['list'],
              },
            ]}
          >
            <SidebarGroup>
              <SidebarGroupLabel>
                {t('layout:nav.configuration')}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <Link to="/manager/users">
                      {({ isActive }) => (
                        <SidebarMenuButton
                          isActive={isActive}
                          render={
                            <span>
                              <UsersIcon />
                              <span>{t('layout:nav.users')}</span>
                            </span>
                          }
                        />
                      )}
                    </Link>
                  </SidebarMenuItem>
                  <WithPermissions permissions={[{ role: ['read'] }]}>
                    <SidebarMenuItem>
                      <Link to="/manager/roles">
                        {({ isActive }) => (
                          <SidebarMenuButton
                            isActive={isActive}
                            render={
                              <span>
                                <ShieldIcon />
                                <span>{t('layout:nav.roles')}</span>
                              </span>
                            }
                          />
                        )}
                      </Link>
                    </SidebarMenuItem>
                  </WithPermissions>
                  <WithPermissions permissions={[{ systemConfig: ['update'] }]}>
                    <SidebarMenuItem>
                      <Link to="/manager/settings">
                        {({ isActive }) => (
                          <SidebarMenuButton
                            isActive={isActive}
                            render={
                              <span>
                                <SettingsIcon />
                                <span>{t('layout:nav.settings')}</span>
                              </span>
                            }
                          />
                        )}
                      </Link>
                    </SidebarMenuItem>
                  </WithPermissions>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </WithPermissions>
        </SidebarContent>
        <SidebarFooter>
          <NavUser />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>{props.children}</SidebarInset>
    </SidebarProvider>
  );
};
