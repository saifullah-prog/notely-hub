import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Crown, ArrowLeft, LogOut, Loader2, Check, Send, CreditCard, Music2,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { usePaymentSettings, useMyPremium, useMyPayments, type Payment } from "@/lib/payments";

export const Route = createFileRoute("/premium")({
  head: () => ({ meta: [{ title: "Premium — Rocky" }] }),
  component: PremiumPage,
});

function PremiumPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, loading, signOut } = useAuth();
  const { data: settings } = usePaymentSettings();
  const { data: premium } = useMyPremium();
  const { data: payments = [] } = useMyPayments();

  const [form, setForm] = useState({ reference: "", sender_name: "", amount: "", note: "" });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  // Prefill the amount from admin settings.
  useEffect(() => {
    if (settings && !form.amount) setForm((f) => ({ ...f, amount: String(settings.amount ?? "") }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }
  if (!user) return null;

  async function submitPayment(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!settings?.subscriptions_open) return;
    if (!form.reference.trim()) return setError("Enter the transaction ID / reference from your transfer.");
    if (!form.sender_name.trim()) return setError("Enter the name you sent the payment from.");

    setBusy(true);
    const { error: err } = await supabase.from("payments").insert({
      user_id: user!.id,
      amount: Number(form.amount) || settings.amount || 0,
      currency: settings.currency,
      method: settings.method,
      reference: form.reference.trim(),
      sender_name: form.sender_name.trim(),
      note: form.note.trim() || null,
    });
    setBusy(false);
    if (err) return setError(err.message);
    setNotice("Payment submitted! An admin will verify it and activate your premium.");
    setForm({ reference: "", sender_name: "", amount: String(settings.amount ?? ""), note: "" });
    qc.invalidateQueries({ queryKey: ["my-payments"] });
  }

  const initial = (user.email ?? "R").charAt(0).toUpperCase();
  const field = "w-full rounded-md bg-elevated border border-input focus:border-primary px-3 py-2 text-sm outline-none transition";
  const statusStyle: Record<string, string> = {
    pending: "bg-yellow-500/15 text-yellow-500",
    approved: "bg-primary/15 text-primary",
    rejected: "bg-destructive/15 text-destructive",
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-elevated to-background text-foreground flex flex-col">
      <header className="flex items-center gap-3 px-4 h-16 shrink-0 border-b border-border bg-sidebar">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg">
          <span className="size-8 rounded-full bg-primary text-primary-foreground grid place-items-center"><Music2 className="size-5" /></span>
          Rocky Premium
        </Link>
        <div className="flex-1" />
        <span className="size-9 rounded-full bg-primary text-primary-foreground grid place-items-center font-bold text-sm uppercase" title={user.email ?? ""}>{initial}</span>
        <Link to="/" className="flex items-center gap-2 px-3 py-2 rounded-full bg-elevated hover:bg-secondary text-sm font-semibold">
          <ArrowLeft className="size-4" /> <span className="hidden sm:block">App</span>
        </Link>
        <button onClick={() => signOut()} className="flex items-center gap-2 px-3 py-2 rounded-full bg-elevated hover:bg-secondary text-sm font-semibold">
          <LogOut className="size-4" /> <span className="hidden sm:block">Log out</span>
        </button>
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto p-4 space-y-6">
        {/* Status */}
        <div className="rounded-xl border border-border bg-card/40 p-6 flex items-center gap-4">
          <span className={`size-14 rounded-full grid place-items-center ${premium?.isPremium ? "bg-primary text-primary-foreground" : "bg-elevated text-muted-foreground"}`}>
            <Crown className="size-7" />
          </span>
          <div>
            <h1 className="text-2xl font-bold">Rocky Premium</h1>
            {premium?.isPremium ? (
              <p className="text-sm text-primary font-medium">Active until {new Date(premium.premiumUntil!).toLocaleDateString()}</p>
            ) : (
              <p className="text-sm text-muted-foreground">You don't have an active subscription.</p>
            )}
          </div>
        </div>

        {/* Subscribe / pay */}
        {settings?.subscriptions_open ? (
          <div className="rounded-xl border border-border bg-card/40 p-6 space-y-5">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2"><CreditCard className="size-5" /> Subscribe — {settings.amount} {settings.currency}/month</h2>
              <p className="text-sm text-muted-foreground mt-1">Pay via <span className="text-foreground font-medium">{settings.method || "the method below"}</span>, then submit your details for verification.</p>
            </div>
            {settings.instructions && (
              <div className="rounded-md bg-elevated/60 border border-border p-3 text-sm whitespace-pre-wrap">{settings.instructions}</div>
            )}

            <form onSubmit={submitPayment} className="space-y-4">
              <h3 className="font-semibold text-sm">I've paid — verify my payment</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <label className="space-y-1 text-sm"><span className="font-medium">Transaction ID / reference</span>
                  <input className={field} value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} placeholder="e.g. TXN123456" />
                </label>
                <label className="space-y-1 text-sm"><span className="font-medium">Sent from (name)</span>
                  <input className={field} value={form.sender_name} onChange={(e) => setForm((f) => ({ ...f, sender_name: e.target.value }))} placeholder="Name on the transfer" />
                </label>
                <label className="space-y-1 text-sm"><span className="font-medium">Amount paid</span>
                  <input className={field} type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
                </label>
                <label className="space-y-1 text-sm"><span className="font-medium">Note (optional)</span>
                  <input className={field} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="Anything the admin should know" />
                </label>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              {notice && <p className="text-sm text-primary flex items-center gap-1"><Check className="size-4" /> {notice}</p>}
              <button type="submit" disabled={busy} className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground font-bold disabled:opacity-60">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Submit for verification
              </button>
            </form>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
            Premium subscriptions are currently closed. Please check back later.
          </div>
        )}

        {/* My payments */}
        {payments.length > 0 && (
          <div className="space-y-2">
            <h2 className="font-semibold">Your payments</h2>
            <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
              {payments.map((p: Payment) => (
                <div key={p.id} className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{p.amount} {p.currency}</div>
                      <div className="text-xs text-muted-foreground truncate">Ref: {p.reference || "—"} · {new Date(p.created_at).toLocaleDateString()}</div>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusStyle[p.status]}`}>{p.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
