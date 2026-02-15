"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUser } from "@/hooks/use-user";
import { createClient } from "@/lib/supabase/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Clock } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const schema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type FormData = z.infer<typeof schema>;

function AcceptContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  const supabase = createClient();
  const { data: user } = useUser();

  const [invite, setInvite] = useState<{
    clientName: string;
    email: string;
  } | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetch(`/api/invite?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          setInviteError(data.error);
          return;
        }
        setInvite({
          clientName: data.clientName,
          email: data.email,
        });
      })
      .catch(() => {
        if (!cancelled) setInviteError("Failed to load invite.");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSignIn(data: FormData) {
    setAcceptError(null);
    const { error } = await supabase.auth.signInWithPassword(data);
    if (error) {
      setAcceptError(error.message);
      return;
    }
    router.refresh();
  }

  async function acceptInvite() {
    if (!token) return;
    setAccepting(true);
    setAcceptError(null);
    try {
      const res = await fetch("/api/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        setAcceptError(data.error ?? "Failed to accept invite");
        setAccepting(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setAcceptError(e instanceof Error ? e.message : "Failed to accept invite");
      setAccepting(false);
    }
  }

  if (!token) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Invalid invite</CardTitle>
          <CardDescription>
            Missing invite token. Use the link from your invite email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">Go to sign in</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (inviteError && !invite) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Invalid invite</CardTitle>
          <CardDescription>{inviteError}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">Go to sign in</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!invite) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Loading invite…</p>
        </CardContent>
      </Card>
    );
  }

  if (user) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-[#3ECF8E]">
            <Clock className="h-6 w-6 text-white" />
          </div>
          <CardTitle>Accept invite</CardTitle>
          <CardDescription>
            You’re invited to view projects and time entries for{" "}
            <strong>{invite.clientName}</strong>. Accept to continue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {acceptError && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {acceptError}
            </div>
          )}
          <Button
            className="w-full bg-[#3ECF8E] hover:bg-[#2EB67D]"
            onClick={acceptInvite}
            disabled={accepting}
          >
            {accepting ? "Accepting…" : "Accept invite"}
          </Button>
          <Button asChild variant="ghost" className="w-full">
            <Link href="/dashboard">Skip (go to dashboard)</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-[#3ECF8E]">
          <Clock className="h-6 w-6 text-white" />
        </div>
        <CardTitle>You’re invited</CardTitle>
        <CardDescription>
          Sign in to view projects and time entries for <strong>{invite.clientName}</strong>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {acceptError && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {acceptError}
          </div>
        )}
        <form onSubmit={handleSubmit(onSignIn)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="you@example.com" {...register("email")} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" {...register("password")} />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          Don’t have an account?{" "}
          <Link
            href={`/signup?invite=${encodeURIComponent(token)}`}
            className="text-[#3ECF8E] hover:underline"
          >
            Create one
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function InviteAcceptPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F4F4F4] p-4">
      <Suspense
        fallback={
          <Card className="w-full max-w-md">
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">Loading…</p>
            </CardContent>
          </Card>
        }
      >
        <AcceptContent />
      </Suspense>
    </div>
  );
}
