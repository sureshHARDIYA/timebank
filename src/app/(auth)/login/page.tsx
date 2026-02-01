"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Clock } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const schema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type FormData = z.infer<typeof schema>;

function LoginFallback() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-[#3ECF8E]">
          <Clock className="h-6 w-6 text-white" />
        </div>
        <CardTitle className="text-2xl">Time Tracker</CardTitle>
        <CardDescription>Sign in to your account</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </CardContent>
    </Card>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [error, setError] = useState<string | null>(null);
  const pendingFromUrl = searchParams.get("pending") === "1";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    setError(null);
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword(data);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    if (!signInData.user) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_approved")
      .eq("id", signInData.user.id)
      .single();
    if (profile?.is_approved !== true) {
      setError("Your account is pending approval. You’ll be able to sign in once approved.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <>
      {isSubmitting && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#3ECF8E] border-t-transparent" />
            <p className="text-sm font-medium text-muted-foreground">Signing you in…</p>
          </div>
        </div>
      )}
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-[#3ECF8E]">
            <Clock className="h-6 w-6 text-white" />
          </div>
          <CardTitle className="text-2xl">Time Tracker</CardTitle>
          <CardDescription>Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingFromUrl && (
            <div className="mb-4 rounded-md bg-muted p-3 text-sm text-muted-foreground">
              Your account is pending approval. Contact the admin to get access.
            </div>
          )}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
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
              {isSubmitting ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginContent />
    </Suspense>
  );
}
