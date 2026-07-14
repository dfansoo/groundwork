"use client";

import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@workspace/ui/components/dropdown-menu";
import { SignOutButton } from "./sign-out-button";

type SessionUser = {
  name?: string | null;
  email?: string | null;
  avatar?: string | null;
};

/** "Jane Kim" -> "JK"; falls back to the first two characters of a single word or the email. */
function initials(user: SessionUser): string {
  const source = user.name?.trim() || user.email?.trim() || "?";
  const words = source.split(/\s+/).filter(Boolean);

  if (words.length >= 2) {
    return `${words[0]![0]}${words[1]![0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function AccountMenu({ user }: { user: SessionUser | null }) {
  if (!user) {
    return (
      <Link
        href="/login"
        className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
      >
        Sign in
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="focus-visible:ring-ring rounded-full outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      >
        <Avatar className="size-9">
          {user.avatar ? <AvatarImage src={user.avatar} alt="" /> : null}
          <AvatarFallback>{initials(user)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-52">
        <div className="px-2 py-2">
          <span className="text-foreground block text-sm font-medium">
            {user.name ?? "Signed in"}
          </span>
          {user.email ? (
            <span className="text-muted-foreground block truncate text-xs">{user.email}</span>
          ) : null}
        </div>

        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/account" />}>My account</DropdownMenuItem>
        <DropdownMenuSeparator />
        <SignOutButton />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
