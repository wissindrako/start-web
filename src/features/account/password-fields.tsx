import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { PASSWORD_LENGTH } from '@/features/access-settings/schema';

/**
 * New password (twice) and, when changing one, the current password. Not a
 * <form>: the user page in the manager is already inside one.
 */
export const PasswordFields = (props: {
  requireCurrent: boolean;
  pending: boolean;
  saveLabel: string;
  onSave: (values: {
    currentPassword?: string;
    newPassword: string;
  }) => Promise<boolean>;
}) => {
  const { t } = useTranslation(['account']);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (props.requireCurrent && !current) {
      setError(t('account:password.currentRequired'));
      return;
    }
    if (next.length < PASSWORD_LENGTH.min) {
      setError(t('account:password.tooShort', { min: PASSWORD_LENGTH.min }));
      return;
    }
    if (next.length > PASSWORD_LENGTH.max) {
      setError(t('account:password.tooLong', { max: PASSWORD_LENGTH.max }));
      return;
    }
    if (next !== confirm) {
      setError(t('account:password.mismatch'));
      return;
    }
    setError(null);
    const saved = await props.onSave({
      currentPassword: props.requireCurrent ? current : undefined,
      newPassword: next,
    });
    if (saved) {
      setCurrent('');
      setNext('');
      setConfirm('');
    }
  };

  return (
    <div className="flex max-w-sm flex-col gap-3">
      {props.requireCurrent && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password-current">
            {t('account:password.current')}
          </Label>
          <Input
            id="password-current"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
          />
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password-new">{t('account:password.new')}</Label>
        <Input
          id="password-new"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(event) => setNext(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password-confirm">
          {t('account:password.confirm')}
        </Label>
        <Input
          id="password-confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void save();
            }
          }}
        />
      </div>
      {!!error && <p className="text-sm text-negative-600">{error}</p>}
      <div>
        <Button
          type="button"
          size="sm"
          loading={props.pending}
          onClick={() => void save()}
        >
          {props.saveLabel}
        </Button>
      </div>
    </div>
  );
};
