"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function signIn(prevState: any, formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const returnUrl = formData.get("returnUrl") as string | undefined;
  
  if (!email || !email.includes('@')) {
    return { messageKey: "auth.invalidEmail" };
  }
  
  if (!password || password.length < 6) {
    return { messageKey: "auth.passwordTooShort" };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    return { message: error.message || "Could not authenticate user" };
  }

  // Use client-side navigation instead of server-side redirect
  return { success: true, redirectTo: returnUrl || "/dashboard" };
}

export async function signUp(prevState: any, formData: FormData) {
  const origin = formData.get("origin") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;
  const returnUrl = formData.get("returnUrl") as string | undefined;
  
  if (!email || !email.includes('@')) {
    return { messageKey: "auth.invalidEmail" };
  }
  
  if (!password || password.length < 6) {
    return { messageKey: "auth.passwordTooShort" };
  }

  if (password !== confirmPassword) {
    return { messageKey: "auth.passwordsDontMatch" };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?returnUrl=${returnUrl}`,
    },
  });

  if (error) {
    return { message: error.message || "Could not create account" };
  }

  // Try to sign in immediately
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (signInError) {
    return { messageKey: "auth.accountCreatedCheckEmail" };
  }

  // Use client-side navigation instead of server-side redirect
  return { success: true, redirectTo: returnUrl || "/dashboard" };
}

export async function forgotPassword(prevState: any, formData: FormData) {
  const email = formData.get("email") as string;
  const origin = formData.get("origin") as string;
  
  if (!email || !email.includes('@')) {
    return { messageKey: "auth.invalidEmail" };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/reset-password`,
  });

  if (error) {
    return { message: error.message || "Could not send password reset email" };
  }

  return { 
    success: true, 
    messageKey: "auth.checkEmailForReset" 
  };
}

export async function resetPassword(prevState: any, formData: FormData) {
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;
  
  if (!password || password.length < 6) {
    return { messageKey: "auth.passwordTooShort" };
  }

  if (password !== confirmPassword) {
    return { messageKey: "auth.passwordsDontMatch" };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({
    password
  });

  if (error) {
    return { message: error.message || "Could not update password" };
  }

  return { 
    success: true, 
    messageKey: "auth.passwordUpdated" 
  };
}

export async function signOut() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    return { message: error.message || "Could not sign out" };
  }

  return redirect("/");
} 