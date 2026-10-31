import { useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export function BootScreen() {
  return (
    <main className="grid min-h-dvh place-items-center bg-paper px-4">
      <div className="text-center">
        <p className="text-sm text-muted">تابعة للسويدي · امتحانات · درجات · حضور</p>
        <h1 className="mt-2 text-2xl font-semibold">مدرسة العالمين</h1>
      </div>
    </main>
  );
}

export function Card({
  title,
  children,
  action,
}: {
  title?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="panel rounded-xl border border-line bg-card p-4">
      {title ? (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          {action}
        </div>
      ) : null}
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function Button({
  variant = "primary",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" }) {
  return (
    <button
      type={type}
      className={cn(
        "press focus-ring inline-flex h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" ? "bg-accent text-accent-fg" : "border border-line bg-card text-ink",
        className,
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "focus-ring h-11 w-full rounded-md border border-line bg-card px-3 text-base text-ink placeholder:text-muted",
        className,
      )}
      {...props}
    />
  );
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "focus-ring min-h-28 w-full rounded-md border border-line bg-card px-3 py-2 text-base text-ink placeholder:text-muted",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "focus-ring h-11 w-full rounded-md border border-line bg-card px-3 text-base text-ink",
        className,
      )}
      {...props}
    />
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-2 text-sm font-medium">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function ConfirmButton({
  label,
  onConfirm,
  disabled,
}: {
  label: string;
  onConfirm: () => Promise<unknown> | void;
  disabled?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  if (!armed) {
    return (
      <Button variant="ghost" disabled={disabled} onClick={() => setArmed(true)}>
        {label}
      </Button>
    );
  }
  return (
    <span className="inline-flex flex-wrap gap-2">
      <Button
        variant="ghost"
        onClick={() => {
          void Promise.resolve(onConfirm()).finally(() => setArmed(false));
        }}
      >
        تأكيد
      </Button>
      <Button variant="ghost" onClick={() => setArmed(false)}>
        رجوع
      </Button>
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted">{children}</p>;
}
