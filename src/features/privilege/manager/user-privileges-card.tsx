import { getUiState } from '@bearstudio/ui-state';
import { zodResolver } from '@hookform/resolvers/zod';
import { ORPCError } from '@orpc/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { orpc } from '@/lib/orpc/client';

import {
  Form,
  FormField,
  FormFieldController,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { WithPermissions } from '@/features/auth/with-permission';
import {
  FormFieldsPrivilege,
  parsePermissionKey,
  permissionKey,
  PRIVILEGE_EFFECTS,
  zFormFieldsPrivilege,
} from '@/features/privilege/schema';
import { AVAILABLE_PERMISSIONS } from '@/features/role/schema';

// "" = the identity center itself (Select needs a string value)
const LOCAL_SYSTEM = '';

type CatalogEntry = { subject: string; action: string };

const LOCAL_CATALOG: CatalogEntry[] = AVAILABLE_PERMISSIONS.flatMap((p) =>
  p.actions.map((action) => ({ subject: p.subject, action }))
);

export const UserPrivilegesCard = (props: {
  userId: string;
  isCurrentUser: boolean;
}) => {
  const { t } = useTranslation(['privilege', 'role']);
  const [systemId, setSystemId] = useState(LOCAL_SYSTEM);

  const systemsQuery = useQuery(orpc.externalSystem.getAll.queryOptions());
  const systems = systemsQuery.data ?? [];
  const selectedSystem = systems.find((s) => s.id === systemId);
  const scope = { userId: props.userId, systemId: systemId || undefined };

  const effectiveQuery = useQuery(
    orpc.privilege.getEffectivePermissions.queryOptions({ input: scope })
  );
  const privilegesQuery = useQuery(
    orpc.privilege.getByUser.queryOptions({ input: scope })
  );

  const catalog: CatalogEntry[] = selectedSystem
    ? selectedSystem.modules.flatMap((m) =>
        m.actions.map((action) => ({ subject: m.name, action }))
      )
    : LOCAL_CATALOG;

  const label = (p: CatalogEntry) => {
    const subject = t(`role:subjects.${p.subject}`, {
      defaultValue: p.subject,
    });
    const action = t(`role:actions.${p.action}`, { defaultValue: p.action });
    return `${subject} · ${action}`;
  };

  const ui = getUiState((set) => {
    if (effectiveQuery.status === 'pending') return set('pending');
    if (privilegesQuery.status === 'pending') return set('pending');
    if (effectiveQuery.status === 'error' || privilegesQuery.status === 'error')
      return set('error');
    return set('default', {
      effective: effectiveQuery.data,
      privileges: privilegesQuery.data,
    });
  });

  return (
    <DataList>
      <DataListRow className="max-md:flex-col max-md:items-stretch max-md:py-2">
        <DataListCell>
          <h2 className="text-sm font-medium">{t('privilege:card.title')}</h2>
          <DataListText className="text-xs text-muted-foreground">
            {t('privilege:card.description')}
          </DataListText>
        </DataListCell>
        <DataListCell className="flex flex-none flex-row items-center gap-2">
          <Select
            value={systemId}
            onValueChange={(value) => setSystemId(value ?? LOCAL_SYSTEM)}
          >
            <SelectTrigger size="sm" className="w-48">
              <SelectValue>
                {selectedSystem
                  ? (selectedSystem.label ?? selectedSystem.name)
                  : t('privilege:card.identityCenter')}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={LOCAL_SYSTEM}>
                {t('privilege:card.identityCenter')}
              </SelectItem>
              {systems.map((system) => (
                <SelectItem key={system.id} value={system.id}>
                  {system.label ?? system.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!props.isCurrentUser && (
            <WithPermissions permissions={[{ privilege: ['manage'] }]}>
              <AddPrivilegeButton
                userId={props.userId}
                systemId={systemId || undefined}
                catalog={catalog}
                label={label}
              />
            </WithPermissions>
          )}
        </DataListCell>
      </DataListRow>

      {ui
        .match('pending', () => <DataListLoadingState />)
        .match('error', () => (
          <DataListErrorState
            retry={() => {
              effectiveQuery.refetch();
              privilegesQuery.refetch();
            }}
          />
        ))
        .match('default', ({ effective, privileges }) => (
          <>
            <DataListRow>
              <DataListCell className="gap-2 py-3">
                <DataListText className="text-xs text-muted-foreground">
                  {effective.roles.length
                    ? t('privilege:card.roles', {
                        roles: effective.roles.map((r) => r.name).join(', '),
                      })
                    : t('privilege:card.noRoles')}
                </DataListText>
                <div className="flex flex-wrap gap-1.5">
                  {effective.permissions.map((p) => (
                    <Badge
                      key={permissionKey(p)}
                      variant={p.source === 'grant' ? 'positive' : 'secondary'}
                      title={t(`privilege:source.${p.source}`)}
                    >
                      {label(p)}
                    </Badge>
                  ))}
                  {effective.denied.map((p) => (
                    <Badge
                      key={`denied-${permissionKey(p)}`}
                      variant="negative"
                      className="line-through"
                      title={t('privilege:source.deny')}
                    >
                      {label(p)}
                    </Badge>
                  ))}
                  {!effective.permissions.length &&
                    !effective.denied.length && (
                      <DataListText className="text-xs text-muted-foreground">
                        {t('privilege:card.noPermissions')}
                      </DataListText>
                    )}
                </div>
              </DataListCell>
            </DataListRow>

            {!privileges.length && (
              <DataListEmptyState className="min-h-16">
                {t('privilege:card.noPrivileges')}
              </DataListEmptyState>
            )}

            {privileges.map((privilege) => (
              <DataListRow
                key={privilege.id}
                className="max-md:flex-col max-md:py-2 max-md:[&>div]:py-1"
              >
                <DataListCell className="flex-row items-center justify-start gap-2">
                  <Badge
                    variant={
                      privilege.effect === 'grant' ? 'positive' : 'negative'
                    }
                  >
                    {t(`privilege:effect.${privilege.effect}`)}
                  </Badge>
                  <DataListText className="font-medium">
                    {label(privilege.permission)}
                  </DataListText>
                  {privilege.expired && (
                    <Badge variant="warning">
                      {t('privilege:card.expired')}
                    </Badge>
                  )}
                </DataListCell>
                <DataListCell>
                  <DataListText className="text-muted-foreground">
                    {privilege.reason || '—'}
                  </DataListText>
                  <DataListText className="text-xs text-muted-foreground">
                    {[
                      privilege.expiresAt
                        ? t('privilege:card.expiresAt', {
                            date: dayjs(privilege.expiresAt).format(
                              'DD/MM/YYYY HH:mm'
                            ),
                          })
                        : t('privilege:card.noExpiry'),
                      privilege.grantedBy
                        ? t('privilege:card.grantedBy', {
                            name:
                              privilege.grantedBy.name ||
                              privilege.grantedBy.email,
                          })
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </DataListText>
                </DataListCell>
                {!props.isCurrentUser && (
                  <WithPermissions permissions={[{ privilege: ['manage'] }]}>
                    <DataListCell className="flex-none">
                      <RemovePrivilegeButton
                        id={privilege.id}
                        userId={props.userId}
                        name={label(privilege.permission)}
                      />
                    </DataListCell>
                  </WithPermissions>
                )}
              </DataListRow>
            ))}
          </>
        ))
        .exhaustive()}
    </DataList>
  );
};

const useInvalidatePrivileges = (userId: string) => {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: orpc.privilege.getByUser.key({ input: { userId } }),
      }),
      queryClient.invalidateQueries({
        queryKey: orpc.privilege.getEffectivePermissions.key({
          input: { userId },
        }),
      }),
    ]);
};

const errorMessage = (
  error: unknown,
  t: (key: 'privilege:errors.forbidden' | 'privilege:errors.generic') => string
) =>
  error instanceof ORPCError && error.code === 'FORBIDDEN'
    ? t('privilege:errors.forbidden')
    : t('privilege:errors.generic');

const AddPrivilegeButton = (props: {
  userId: string;
  systemId: string | undefined;
  catalog: CatalogEntry[];
  label: (p: CatalogEntry) => string;
}) => {
  const { t } = useTranslation(['privilege']);
  const [isOpen, setIsOpen] = useState(false);
  const invalidate = useInvalidatePrivileges(props.userId);

  const form = useForm<FormFieldsPrivilege>({
    resolver: zodResolver(zFormFieldsPrivilege()),
    defaultValues: {
      permission: '',
      effect: 'grant',
      reason: '',
      expiresAt: undefined,
    },
  });

  const setPrivilege = useMutation(
    orpc.privilege.set.mutationOptions({
      onSuccess: async () => {
        await invalidate();
        toast.success(t('privilege:add.success'));
        setIsOpen(false);
        form.reset();
      },
      onError: (error) => toast.error(errorMessage(error, t)),
    })
  );

  const submit = form.handleSubmit((values) => {
    setPrivilege.mutate({
      userId: props.userId,
      systemId: props.systemId,
      ...parsePermissionKey(values.permission),
      effect: values.effect,
      reason: values.reason || undefined,
      expiresAt: values.expiresAt,
    });
  });

  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => setIsOpen(true)}
        disabled={!props.catalog.length}
      >
        <PlusIcon />
        {t('privilege:add.button')}
      </Button>

      <ResponsiveDrawer open={isOpen} onOpenChange={setIsOpen}>
        <ResponsiveDrawerContent className="sm:max-w-md">
          <ResponsiveDrawerHeader>
            <ResponsiveDrawerTitle>
              {t('privilege:add.title')}
            </ResponsiveDrawerTitle>
            <ResponsiveDrawerDescription>
              {t('privilege:add.description')}
            </ResponsiveDrawerDescription>
          </ResponsiveDrawerHeader>

          <Form {...form}>
            <div className="flex flex-col gap-4 px-4 pb-2 sm:px-6">
              <FormField>
                <FormFieldLabel>
                  {t('privilege:fields.permission')}
                </FormFieldLabel>
                <FormFieldController
                  type="select"
                  control={form.control}
                  name="permission"
                  placeholder={t('privilege:fields.permissionPlaceholder')}
                  items={props.catalog.map((p) => ({
                    value: permissionKey(p),
                    label: props.label(p),
                  }))}
                />
              </FormField>
              <FormField>
                <FormFieldLabel>{t('privilege:fields.effect')}</FormFieldLabel>
                <FormFieldController
                  type="select"
                  control={form.control}
                  name="effect"
                  items={PRIVILEGE_EFFECTS.map((effect) => ({
                    value: effect,
                    label: t(`privilege:effect.${effect}`),
                  }))}
                />
              </FormField>
              <FormField>
                <FormFieldLabel>{t('privilege:fields.reason')}</FormFieldLabel>
                <FormFieldController
                  type="textarea"
                  control={form.control}
                  name="reason"
                  placeholder={t('privilege:fields.reasonPlaceholder')}
                  rows={2}
                />
              </FormField>
              <FormField>
                <FormFieldLabel>
                  {t('privilege:fields.expiresAt')}
                </FormFieldLabel>
                <FormFieldController
                  type="date"
                  control={form.control}
                  name="expiresAt"
                />
              </FormField>
            </div>
          </Form>

          <ResponsiveDrawerFooter>
            <Button variant="secondary" onClick={() => setIsOpen(false)}>
              {t('privilege:add.cancel')}
            </Button>
            <Button onClick={submit} loading={setPrivilege.isPending}>
              {t('privilege:add.save')}
            </Button>
          </ResponsiveDrawerFooter>
        </ResponsiveDrawerContent>
      </ResponsiveDrawer>
    </>
  );
};

const RemovePrivilegeButton = (props: {
  id: string;
  userId: string;
  name: string;
}) => {
  const { t } = useTranslation(['privilege']);
  const invalidate = useInvalidatePrivileges(props.userId);

  const remove = useMutation(
    orpc.privilege.deleteById.mutationOptions({
      onSuccess: async () => {
        await invalidate();
        toast.success(t('privilege:remove.success'));
      },
      onError: (error) => toast.error(errorMessage(error, t)),
    })
  );

  return (
    <ConfirmResponsiveDrawer
      onConfirm={() => remove.mutate({ id: props.id })}
      title={t('privilege:remove.confirmTitle', { name: props.name })}
      description={t('privilege:remove.confirmDescription')}
      confirmText={t('privilege:remove.button')}
      confirmVariant="destructive"
    >
      <Button
        size="icon-sm"
        variant="ghost"
        loading={remove.isPending}
        aria-label={t('privilege:remove.button')}
      >
        <Trash2Icon />
      </Button>
    </ConfirmResponsiveDrawer>
  );
};
