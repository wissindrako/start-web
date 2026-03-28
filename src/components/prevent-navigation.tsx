import { Block } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  ResponsiveDrawer,
  ResponsiveDrawerClose,
  ResponsiveDrawerContent,
  ResponsiveDrawerDescription,
  ResponsiveDrawerFooter,
  ResponsiveDrawerHeader,
  ResponsiveDrawerTitle,
} from '@/components/ui/responsive-drawer';

export const PreventNavigation = (props: { shouldBlock: boolean }) => {
  const { t } = useTranslation(['components']);
  const [isOpen, setIsOpen] = useState(false);
  const resolverRef = useRef<((shouldBlock: boolean) => void) | null>(null);

  const handleConfirm = () => {
    setIsOpen(false);
    resolverRef.current?.(false); // leave
  };

  const handleCancel = () => {
    setIsOpen(false);
    resolverRef.current?.(true); // stay
  };

  return (
    <>
      <Block
        shouldBlockFn={() => {
          if (!props.shouldBlock) return false;
          return new Promise<boolean>((resolve) => {
            resolverRef.current = resolve;
            setIsOpen(true);
          });
        }}
        withResolver
        enableBeforeUnload={props.shouldBlock}
      />
      <ResponsiveDrawer
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) handleCancel();
        }}
      >
        <ResponsiveDrawerContent hideCloseButton className="sm:max-w-xs">
          <ResponsiveDrawerHeader>
            <ResponsiveDrawerTitle>
              {t('components:preventNavigation.confirmLabel')}
            </ResponsiveDrawerTitle>
            <ResponsiveDrawerDescription>
              {t('components:preventNavigation.description')}
            </ResponsiveDrawerDescription>
          </ResponsiveDrawerHeader>
          <ResponsiveDrawerFooter>
            <ResponsiveDrawerClose
              render={<Button variant="secondary" className="max-sm:w-full" />}
            >
              {t('components:preventNavigation.cancelText')}
            </ResponsiveDrawerClose>
            <Button
              variant="destructive"
              className="max-sm:w-full"
              onClick={handleConfirm}
            >
              {t('components:preventNavigation.confirmText')}
            </Button>
          </ResponsiveDrawerFooter>
        </ResponsiveDrawerContent>
      </ResponsiveDrawer>
    </>
  );
};
