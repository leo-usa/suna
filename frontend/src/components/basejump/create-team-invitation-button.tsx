'use client'

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import NewInvitationForm from "./new-invitation-form"
import { useTranslation } from 'react-i18next';

type Props = {
    accountId: string
}

export default function CreateTeamInvitationButton({accountId}: Props) {
  const { t } = useTranslation();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          className="rounded-lg h-9 border-subtle dark:border-white/10 hover:bg-hover-bg dark:hover:bg-hover-bg-dark"
        >
          {t('teamInvitations.inviteMember', 'Invite Member')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] border-subtle dark:border-white/10 bg-card-bg dark:bg-background-secondary rounded-2xl shadow-custom">
        <DialogHeader>
          <DialogTitle className="text-card-title">{t('teamInvitations.inviteTeamMember', 'Invite Team Member')}</DialogTitle>
          <DialogDescription className="text-foreground/70">
            {t('teamInvitations.sendEmail', 'Send an email invitation to join your team')}
          </DialogDescription>
        </DialogHeader>
        <NewInvitationForm accountId={accountId} />
      </DialogContent>
    </Dialog>
  )
}
