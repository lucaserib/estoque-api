export function emailsAdminPlataforma(): string[] {
  return (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function ehAdminPlataforma(email: string | null | undefined): boolean {
  if (!email) return false;
  return emailsAdminPlataforma().includes(email.trim().toLowerCase());
}
