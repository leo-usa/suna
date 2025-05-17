'use client';

import React from 'react';
import AcceptTeamInvitation from "@/components/basejump/accept-team-invitation";
import { redirect } from "next/navigation"

type InvitationSearchParams = {
  token?: string;
};

export default function InvitationPage({ searchParams }: { searchParams: InvitationSearchParams }) {
    if (!searchParams.token) {
       redirect("/");
    }

    return (
        <div className="max-w-md mx-auto w-full my-12">
            <AcceptTeamInvitation token={searchParams.token} />
        </div>
    )
}