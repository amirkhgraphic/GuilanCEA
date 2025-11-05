import * as React from "react";

type PaymentResultProps = {
  title: string;
  subtitle?: string;
  details?: Array<{ label: string; value: React.ReactNode }>;
  className?: string;
};

export default function PaymentResult({
  title,
  subtitle,
  details,
  className,
}: PaymentResultProps) {
  return (
    <div
      className={[
        "mx-auto max-w-xl rounded-2xl border border-border bg-card text-card-foreground shadow-sm",
        "transition-colors",
        className,
      ].join(" ")}
    >
      <div className="p-6">
        <h1 className="text-2xl font-semibold leading-tight">{title}</h1>
        {subtitle && (
          <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
        )}

        {details?.length ? (
          <ul className="mt-6 divide-y divide-border/60">
            {details.map((d, i) => (
              <li
                key={i}
                className="flex items-start justify-between gap-4 py-3"
              >
                <span className="text-sm text-muted-foreground">{d.label}</span>
                <span className="font-medium text-right text-foreground break-words">
                  {d.value}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
