import { getUiState } from '@bearstudio/ui-state';
import { zodResolver } from '@hookform/resolvers/zod';
import { ORPCError } from '@orpc/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import dayjs from 'dayjs';
import { t } from 'i18next';
import {
  MailPlusIcon,
  RefreshCwIcon,
  SendIcon,
  Trash2Icon,
} from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';

import { orpc } from '@/lib/orpc/client';

import { BackButton } from '@/components/back-button';
import {
  Form,
  FormField,
  FormFieldController,
  FormFieldHelper,
  FormFieldLabel,
} from '@/components/form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmResponsiveDrawer } from '@/components/ui/confirm-responsive-drawer';
import {
  DataList,
  DataListCell,
  DataListEmptyState,
  DataListErrorState,
  DataListLoadingState,
  DataListRow,
  DataListText,
} from '@/components/ui/datalist';
import {
  ResponsiveDrawer,
  ResponsiveDrawerContent,
  ResponsiveDrawerDescription,
  ResponsiveDrawerFooter,
  ResponsiveDrawerHeader,
  ResponsiveDrawerTitle,
} from '@/components/ui/responsive-drawer';
import { ResponsiveIconButton } from '@/components/ui/responsive-icon-button';

import { useAccessSettings } from '@/features/access-settings/use-access-settings';
import { WithPermissions } from '@/features/auth/with-permission';
import {
  PageLayout,
  PageLayoutContent,
  PageLayoutTopBar,
  PageLayoutTopBarTitle,
} from '@/layout/manager/page-layout';

const STATUS_VARIANT = {
  pending: 'warning',
  accepted: 'positive',
  expired: 'secondary',
} as const;

const useInvalidateInvitations = () => {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: orpc.invitation.getAll.key() });
};

// Invitations to join while public sign-up is closed: who was invited,
// with which roles, and whether they already joined
const formatDomains = (domains: string[]) =>
  domains.map((domain) => `@${domain}`).join(', ');

export const PageInvitations = () => {
  const { t } = useTranslation(['invitation']);
  const invitationsQuery = useQuery(orpc.invitation.getAll.queryOptions());
  const { settings } = useAccessSettings();

  const ui = getUiState((set) => {
    if (invitationsQuery.status === 'pending') return set('pending');
    if (invitationsQuery.status === 'error') return set('error');
    if (!invitationsQuery.data.length) return set('empty');
    return set('default', { items: invitationsQuery.data });
  });

  return (
    <PageLayout>
      <PageLayoutTopBar
        startActions={<BackButton />}
        endActions={
          <>
            <ResponsiveIconButton
              label={t('invitation:list.refresh')}
              variant="ghost"
              size="sm"
              loading={invitationsQuery.isFetching}
              onClick={() => invitationsQuery.refetch()}
            >
              <RefreshCwIcon />
            </ResponsiveIconButton>
            <WithPermissions permissions={[{ user: ['create'] }]}>
              <InviteButton />
            </WithPermissions>
          </>
        }
      >
        <PageLayoutTopBarTitle>
          {t('invitation:list.title')}
        </PageLayoutTopBarTitle>
      </PageLayoutTopBar>
      <PageLayoutContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          {settings.signupEnabled
            ? t('invitation:list.signupOpen')
            : t('invitation:list.signupClosed')}
        </p>
        <DataList>
          {ui
            .match('pending', () => <DataListLoadingState />)
            .match('error', () => (
              <DataListErrorState retry={() => invitationsQuery.refetch()} />
            ))
            .match('empty', () => (
              <DataListEmptyState>
                {t('invitation:list.empty')}
              </DataListEmptyState>
            ))
            .match('default', ({ items }) =>
              items.map((invitation) => (
                <DataListRow key={invitation.id} data-testid="invitation-row">
                  <DataListCell>
                    <DataListText className="font-medium">
                      {invitation.email}
                    </DataListText>
                    <DataListText className="text-xs text-muted-foreground">
                      {invitation.invitedBy
                        ? t('invitation:list.invitedBy', {
                            name: invitation.invitedBy.name,
                            date: dayjs(invitation.createdAt).format(
                              'DD/MM/YYYY'
                            ),
                          })
                        : dayjs(invitation.createdAt).format('DD/MM/YYYY')}
                    </DataListText>
                  </DataListCell>
                  <DataListCell className="flex-row flex-wrap items-center justify-start gap-1 max-md:hidden">
                    <Badge
                      variant={invitation.system ? 'default' : 'secondary'}
                    >
                      {invitation.system
                        ? (invitation.system.label ?? invitation.system.name)
                        : t('invitation:invite.localSystem')}
                    </Badge>
                    {invitation.roles.map((role) => (
                      <Badge key={role.id} variant="secondary">
                        {role.name}
                      </Badge>
                    ))}
                  </DataListCell>
                  <DataListCell className="flex-none">
                    <Badge variant={STATUS_VARIANT[invitation.status]}>
                      {t(`invitation:status.${invitation.status}`)}
                    </Badge>
                    <DataListText className="text-xs text-muted-foreground">
                      {invitation.status === 'accepted' && invitation.acceptedAt
                        ? dayjs(invitation.acceptedAt).format('DD/MM/YYYY')
                        : t('invitation:list.expiresAt', {
                            date: dayjs(invitation.expiresAt).format(
                              'DD/MM/YYYY'
                            ),
                          })}
                    </DataListText>
                  </DataListCell>
                  <DataListCell className="flex-none flex-row gap-1">
                    {invitation.status !== 'accepted' && (
                      <WithPermissions permissions={[{ user: ['create'] }]}>
                        <ResendButton id={invitation.id} />
                        <RevokeButton
                          id={invitation.id}
                          email={invitation.email}
                        />
                      </WithPermissions>
                    )}
                  </DataListCell>
                </DataListRow>
              ))
            )
            .exhaustive()}
        </DataList>
      </PageLayoutContent>
    </PageLayout>
  );
};

// The select needs a value for "this center"
const LOCAL_SYSTEM = 'local';

const zFormFieldsInvitation = () =>
  z
    .object({
      email: z.email(),
      systemId: z.string(),
      roleIds: z.array(z.string()),
    })
    .refine(
      (values) => values.systemId === LOCAL_SYSTEM || values.roleIds.length,
      {
        path: ['roleIds'],
        message: t('invitation:invite.systemRoleRequired'),
      }
    );

type FormFieldsInvitation = z.infer<ReturnType<typeof zFormFieldsInvitation>>;

const InviteButton = () => {
  const { t } = useTranslation(['invitation']);
  const { settings } = useAccessSettings();
  const [isOpen, setIsOpen] = useState(false);
  const invalidate = useInvalidateInvitations();
  const rolesQuery = useQuery(
    orpc.role.getAll.queryOptions({ input: { limit: 100 } })
  );

  const form = useForm<FormFieldsInvitation>({
    resolver: zodResolver(zFormFieldsInvitation()),
    defaultValues: { email: '', systemId: LOCAL_SYSTEM, roleIds: [] },
  });
  const systemId = useWatch({ control: form.control, name: 'systemId' });
  const [existingUserId, setExistingUserId] = useState<string | null>(null);

  const invite = useMutation(
    orpc.invitation.create.mutationOptions({
      onSuccess: async () => {
        await invalidate();
        toast.success(t('invitation:invite.success'));
        setIsOpen(false);
        setExistingUserId(null);
        form.reset();
      },
      onError: (error) => {
        const data =
          error instanceof ORPCError
            ? (error.data as { reason?: string; userId?: string } | undefined)
            : undefined;
        const reason = data?.reason;
        if (reason === 'userExists' || reason === 'pendingInvitation') {
          setExistingUserId(
            reason === 'userExists' ? (data?.userId ?? null) : null
          );
          form.setError('email', {
            message: t(
              reason === 'userExists' && systemId !== LOCAL_SYSTEM
                ? 'invitation:invite.userExistsSystem'
                : `invitation:invite.${reason}`
            ),
          });
          return;
        }
        if (reason === 'emailFailed') {
          toast.error(t('invitation:invite.emailFailed'));
          return;
        }
        if (reason === 'domainNotAllowed') {
          form.setError('email', {
            message: t('invitation:invite.domainNotAllowed', {
              domains: formatDomains(settings.allowedDomains),
            }),
          });
          return;
        }
        if (reason === 'systemRoleRequired') {
          form.setError('roleIds', {
            message: t('invitation:invite.systemRoleRequired'),
          });
          return;
        }
        toast.error(
          error instanceof ORPCError && error.code === 'FORBIDDEN'
            ? t('invitation:invite.forbidden')
            : t('invitation:invite.error')
        );
      },
    })
  );

  const roles = rolesQuery.data?.items ?? [];
  // Systems that have roles to give; this center comes first
  const systems = [
    ...new Map(
      roles
        .filter((role) => role.externalSystem)
        .map((role) => [role.externalSystem!.id, role.externalSystem!])
    ).values(),
  ];
  const systemOptions = [
    { value: LOCAL_SYSTEM, label: t('invitation:invite.localSystem') },
    ...systems.map((system) => ({
      value: system.id,
      label: system.label ?? system.name,
    })),
  ];
  const roleOptions = roles
    .filter((role) =>
      systemId === LOCAL_SYSTEM ? !role.systemId : role.systemId === systemId
    )
    .map((role) => ({ value: role.id, label: role.name }));

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setIsOpen(true)}>
        <MailPlusIcon />
        {t('invitation:invite.button')}
      </Button>
      <ResponsiveDrawer open={isOpen} onOpenChange={setIsOpen}>
        <ResponsiveDrawerContent className="sm:max-w-md">
          <ResponsiveDrawerHeader>
            <ResponsiveDrawerTitle>
              {t('invitation:invite.title')}
            </ResponsiveDrawerTitle>
            <ResponsiveDrawerDescription>
              {t('invitation:invite.description', {
                days: settings.invitationDays,
              })}
            </ResponsiveDrawerDescription>
          </ResponsiveDrawerHeader>
          <Form
            {...form}
            onSubmit={(values) =>
              invite.mutate({
                ...values,
                systemId:
                  values.systemId === LOCAL_SYSTEM ? null : values.systemId,
              })
            }
            className="flex flex-col gap-4 px-4 pb-2 sm:px-6"
          >
            <FormField>
              <FormFieldLabel>{t('invitation:invite.email')}</FormFieldLabel>
              <FormFieldController
                type="text"
                control={form.control}
                name="email"
                placeholder="nombre@empresa.com"
                autoFocus
              />
              {!!settings.allowedDomains.length && !existingUserId && (
                <FormFieldHelper>
                  {t('invitation:invite.allowedDomains', {
                    domains: formatDomains(settings.allowedDomains),
                  })}
                </FormFieldHelper>
              )}
              {existingUserId && (
                <FormFieldHelper>
                  <Link
                    to="/manager/users/$id/update"
                    params={{ id: existingUserId }}
                    className="font-medium underline underline-offset-4"
                  >
                    {t('invitation:invite.openUser')}
                  </Link>
                </FormFieldHelper>
              )}
            </FormField>
            <FormField>
              <FormFieldLabel>{t('invitation:invite.system')}</FormFieldLabel>
              <FormFieldController
                type="select"
                control={form.control}
                name="systemId"
                items={systemOptions}
                onValueChange={() => form.setValue('roleIds', [])}
              />
              <FormFieldHelper>
                {systemId === LOCAL_SYSTEM
                  ? t('invitation:invite.systemLocalHelper')
                  : t('invitation:invite.systemExternalHelper')}
              </FormFieldHelper>
            </FormField>
            <FormField>
              <FormFieldLabel>{t('invitation:invite.roles')}</FormFieldLabel>
              <FormFieldController
                type="checkbox-group"
                control={form.control}
                name="roleIds"
                options={roleOptions}
              />
              <FormFieldHelper>
                {t('invitation:invite.rolesHelper')}
              </FormFieldHelper>
            </FormField>
            <ResponsiveDrawerFooter>
              <Button type="submit" loading={invite.isPending}>
                {t('invitation:invite.submit')}
              </Button>
            </ResponsiveDrawerFooter>
          </Form>
        </ResponsiveDrawerContent>
      </ResponsiveDrawer>
    </>
  );
};

const ResendButton = (props: { id: string }) => {
  const { t } = useTranslation(['invitation']);
  const invalidate = useInvalidateInvitations();
  const resend = useMutation(
    orpc.invitation.resend.mutationOptions({
      onSuccess: async () => {
        await invalidate();
        toast.success(t('invitation:resend.success'));
      },
      onError: (error) => {
        const reason =
          error instanceof ORPCError
            ? (error.data as { reason?: string } | undefined)?.reason
            : undefined;
        if (reason === 'emailFailed') {
          toast.error(t('invitation:resend.emailFailed'));
        } else if (reason === 'domainNotAllowed') {
          toast.error(t('invitation:resend.domainNotAllowed'));
        } else {
          toast.error(t('invitation:invite.error'));
        }
      },
    })
  );
  return (
    <ResponsiveIconButton
      label={t('invitation:resend.button')}
      variant="ghost"
      size="sm"
      loading={resend.isPending}
      onClick={() => resend.mutate({ id: props.id })}
    >
      <SendIcon />
    </ResponsiveIconButton>
  );
};

const RevokeButton = (props: { id: string; email: string }) => {
  const { t } = useTranslation(['invitation']);
  const invalidate = useInvalidateInvitations();
  const revoke = useMutation(
    orpc.invitation.deleteById.mutationOptions({
      onSuccess: async () => {
        await invalidate();
        toast.success(t('invitation:revoke.success'));
      },
      onError: () => toast.error(t('invitation:invite.error')),
    })
  );
  return (
    <ConfirmResponsiveDrawer
      onConfirm={() => revoke.mutate({ id: props.id })}
      title={t('invitation:revoke.confirmTitle', { email: props.email })}
      description={t('invitation:revoke.confirmDescription')}
      confirmText={t('invitation:revoke.button')}
      confirmVariant="destructive"
    >
      <ResponsiveIconButton
        label={t('invitation:revoke.button')}
        variant="ghost"
        size="sm"
      >
        <Trash2Icon />
      </ResponsiveIconButton>
    </ConfirmResponsiveDrawer>
  );
};
