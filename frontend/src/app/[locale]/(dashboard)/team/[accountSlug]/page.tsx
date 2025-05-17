'use client';

import { redirect } from 'next/navigation';
import React from 'react';

type AccountParams = {
  accountSlug: string;
};

export default function TeamAccountPage({ params }: { params: AccountParams }) {
  const { accountSlug } = params;
  
  // Redirect to the settings page
  redirect(`/${accountSlug}/settings`);
}