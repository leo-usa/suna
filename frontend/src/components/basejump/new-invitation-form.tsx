'use client'
import { SubmitButton } from "../ui/submit-button"
import { Label } from "../ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectLabel, SelectItem } from "@/components/ui/select";
import { createInvitation } from "@/lib/actions/invitations";
import { useFormState } from "react-dom";
import fullInvitationUrl from "@/lib/full-invitation-url";
import { useTranslation } from 'react-i18next';

type Props = {
    accountId: string
}

const invitationOptions = [
    { label: '24 Hour', value: '24_hour' },
    { label: 'One time use', value: 'one_time' },
]

const memberOptions = [
    { label: 'Owner', value: 'owner' },
    { label: 'Member', value: 'member' },

]

const initialState = {
    message: "",
    token: ""
};

export default function NewInvitationForm({ accountId }: Props) {
    const { t } = useTranslation();
    const [state, formAction] = useFormState(createInvitation, initialState)

    return (
        <form className="animate-in flex-1 flex flex-col w-full justify-center gap-y-6 text-foreground">
            {Boolean(state?.token) ? (
                <div className="text-sm">
                    {fullInvitationUrl(state.token!)}
                </div>
            ) : (
                <>
                    <input type="hidden" name="accountId" value={accountId} />
                    <div className="flex flex-col gap-y-2">
                        <Label htmlFor="invitationType">
                            {t('teamInvitations.typeLabel', 'Invitation Type')}
                        </Label>
                        <Select defaultValue="one_time" name="invitationType">
                            <SelectTrigger>
                                <SelectValue placeholder={t('teamInvitations.typePlaceholder', 'Invitation type')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="24_hour">{t('teamInvitations.type.24hour', '24 Hour')}</SelectItem>
                                <SelectItem value="one_time">{t('teamInvitations.type.oneTime', 'One time use')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex flex-col gap-y-2">
                        <Label htmlFor="accountRole">
                            {t('teamInvitations.roleLabel', 'Team Role')}
                        </Label>
                        <Select defaultValue="member" name="accountRole">
                            <SelectTrigger>
                                <SelectValue placeholder={t('teamInvitations.rolePlaceholder', 'Member type')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="owner">{t('teamInvitations.role.owner', 'Owner')}</SelectItem>
                                <SelectItem value="member">{t('teamInvitations.role.member', 'Member')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <SubmitButton
                        formAction={async (prevState: any, formData: FormData) => formAction(formData)}
                        errorMessage={state?.message}
                        pendingText={t('teamInvitations.creating', 'Creating...')}
                    >
                        {t('teamInvitations.create', 'Create invitation')}
                    </SubmitButton>
                </>
            )}
        </form>
    )
}