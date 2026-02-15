import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string }[]) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
        },
      },
    }
  );

  const pathname = request.nextUrl.pathname;

  // Disable public signup unless they have an invite token
  if (pathname === "/signup" && !request.nextUrl.searchParams.get("invite")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthPage = pathname === "/login";
  const isInviteAcceptPage = pathname === "/invite/accept";

  if (!user && !isAuthPage && pathname !== "/" && !isInviteAcceptPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_approved")
      .eq("id", user.id)
      .single();

    const isApproved = profile?.is_approved === true;

    if (!isApproved) {
      // Not approved: allow login, home, and invite accept (so they can accept and get approved)
      if (pathname !== "/" && pathname !== "/login" && !isInviteAcceptPage) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set("pending", "1");
        return NextResponse.redirect(url);
      }
    } else if (pathname === "/" || isAuthPage) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return response;
}
