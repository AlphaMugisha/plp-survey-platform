import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/brand/logo";

/**
 * Shared chrome for the three staff auth pages: sign in, forgot password and
 * reset password. Keeping it in one place means they cannot drift apart.
 */
export function AuthShell({
  icon,
  title,
  description,
  children,
  footer,
  backHref = "/",
  backLabel = "Back to the survey",
}: {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <main
      id="main"
      className="flex min-h-dvh items-center justify-center bg-canvas px-5 py-14"
    >
      <div className="w-full max-w-md">
        <Link
          href={backHref}
          className="mb-7 inline-flex items-center gap-1.5 rounded-xl text-[0.8125rem] font-medium text-ink-muted transition-colors hover:text-plp-700"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {backLabel}
        </Link>

        <div className="card-lux p-7 sm:p-8">
          <Logo className="mb-7" />

          <div className="mb-1 flex items-center gap-2">
            {icon}
            <h1 className="font-display text-[1.5rem] font-bold tracking-tight text-plp-800">
              {title}
            </h1>
          </div>

          {description && (
            <div className="mb-7 text-[0.9375rem] leading-relaxed text-ink-muted">
              {description}
            </div>
          )}

          {children}
        </div>

        {footer && (
          <div className="mt-6 text-center text-[0.8125rem] leading-relaxed text-ink-faint">
            {footer}
          </div>
        )}
      </div>
    </main>
  );
}
