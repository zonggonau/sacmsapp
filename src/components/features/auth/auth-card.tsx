import type { ReactNode } from "react";

/** Kerangka bersama seluruh layar autentikasi, supaya judul dan jarak seragam. */
export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
        {description ? (
          <p className="text-muted-foreground text-sm">{description}</p>
        ) : null}
      </div>

      {children}

      {footer ? (
        <p className="text-muted-foreground text-center text-sm">{footer}</p>
      ) : null}
    </div>
  );
}

/** Pesan error satu field. Terhubung ke input lewat aria-describedby. */
export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-destructive text-sm">
      {message}
    </p>
  );
}
