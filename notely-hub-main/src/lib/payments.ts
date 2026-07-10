import { useQuery } from "@tanstack/react-query";

import { supabase, isSupabaseConfigured } from "./supabase";
import { useAuth } from "./auth";

export type PaymentSettings = {
  id: number;
  subscriptions_open: boolean;
  amount: number;
  currency: string;
  method: string;
  instructions: string;
  updated_at: string;
};

export type PaymentStatus = "pending" | "approved" | "rejected";

export type Payment = {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  method: string | null;
  reference: string | null;
  sender_name: string | null;
  note: string | null;
  status: PaymentStatus;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
};

/** Admin-controlled payment/subscription settings (single row). */
export function usePaymentSettings() {
  return useQuery({
    queryKey: ["payment-settings"],
    enabled: isSupabaseConfigured,
    queryFn: async (): Promise<PaymentSettings | null> => {
      const { data, error } = await supabase.from("payment_settings").select("*").eq("id", 1).maybeSingle();
      if (error) return null;
      return (data as PaymentSettings) ?? null;
    },
  });
}

/** The current user's premium expiry, and whether it's active. */
export function useMyPremium() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["premium", user?.id],
    enabled: Boolean(user) && isSupabaseConfigured,
    queryFn: async (): Promise<{ premiumUntil: string | null; isPremium: boolean }> => {
      if (!user) return { premiumUntil: null, isPremium: false };
      const { data } = await supabase.from("profiles").select("premium_until").eq("id", user.id).maybeSingle();
      const premiumUntil = (data?.premium_until as string | null) ?? null;
      const isPremium = Boolean(premiumUntil && new Date(premiumUntil).getTime() > Date.now());
      return { premiumUntil, isPremium };
    },
  });
}

/** The current user's payment submissions (newest first). */
export function useMyPayments() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-payments", user?.id],
    enabled: Boolean(user) && isSupabaseConfigured,
    queryFn: async (): Promise<Payment[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Payment[];
    },
  });
}

/** All payments (admins only, via RLS) — the verification queue. */
export function useAllPayments(enabled: boolean) {
  return useQuery({
    queryKey: ["payments"],
    enabled: enabled && isSupabaseConfigured,
    queryFn: async (): Promise<Payment[]> => {
      const { data, error } = await supabase.from("payments").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Payment[];
    },
  });
}
