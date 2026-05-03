'use client';

import React, { useEffect } from 'react';
import { DobbyLoader } from '@/components/ui/dobby-loader';
import { useTranslations } from 'next-intl';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface DeleteConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  threadName: string;
  isDeleting: boolean;
  /** Multiple selected threads — different title and confirmation wording */
  isBulk?: boolean;
}

export function DeleteConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  threadName,
  isDeleting,
  isBulk = false,
}: DeleteConfirmationDialogProps) {
  const t = useTranslations('sidebar');
  const tCommon = useTranslations('common');

  useEffect(() => {
    if (isOpen) {
      document.body.style.pointerEvents = 'auto';
    }
  }, [isOpen]);

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isBulk ? t('deleteConversationsTitle') : t('deleteConversationTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-muted-foreground text-sm space-y-2">
              <p>
                {isBulk
                  ? t.rich('deleteConversationsBulkDescriptionRich', {
                      name: threadName,
                      bold: (chunks) => <span className="font-semibold">{chunks}</span>,
                    })
                  : t.rich('deleteConversationDescriptionRich', {
                      name: threadName,
                      bold: (chunks) => <span className="font-semibold">{chunks}</span>,
                    })}
              </p>
              <p>{t('deleteConversationCannotUndo')}</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>{tCommon('cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isDeleting}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {isDeleting ? (
              <>
                <DobbyLoader size="small" className="mr-2" />
                {t('deleteConversationDeleting')}
              </>
            ) : (
              tCommon('delete')
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
