'use client';

import React, { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
}

/**
 * Confirmation dialog for deleting a conversation
 */
export function DeleteConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  threadName,
  isDeleting,
}: DeleteConfirmationDialogProps) {
  const { t } = useTranslation();

  // Reset pointer events when dialog opens
  useEffect(() => {
    if (isOpen) {
      document.body.style.pointerEvents = 'auto';
    }
  }, [isOpen]);

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('dashboard.deleteConversation.title', 'Delete conversation')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('dashboard.deleteConversation.description', 'Are you sure you want to delete the conversation')}{' '}
            <span className="font-semibold">"{threadName}"</span>?
            <br />
            {t('dashboard.deleteConversation.cannotUndone', 'This action cannot be undone.')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>{t('dashboard.deleteConversation.cancel', 'Cancel')}</AlertDialogCancel>
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
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('dashboard.deleteConversation.deleting', 'Deleting...')}
              </>
            ) : (
              t('dashboard.deleteConversation.delete', 'Delete')
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
