import { cn } from "@/app/lib/utils";

type FlightTraksMarkProps = {
  className?: string;
  title?: string;
};

export function FlightTraksMark({ className, title = "FlightTraks" }: FlightTraksMarkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      className={cn("h-8 w-8", className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      <rect width="64" height="64" rx="14" fill="#0f172a" />
      <path
        d="M10 42c8-2 11-11 19-13 9-2 12 9 21 7 6-2 10-8 14-16"
        fill="none"
        stroke="#38bdf8"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="42" r="3.2" fill="#e2e8f0" />
      <path
        d="M46 18l8 3-8 3-3 7-3-1 1-6-5-2-3 1-1-1 3-3 5-2-1-6 3-1z"
        fill="#e2e8f0"
      />
    </svg>
  );
}

export function FlightTraksMarkInverted({
  className,
  title = "FlightTraks"
}: FlightTraksMarkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      className={cn("h-8 w-8", className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      <rect width="64" height="64" rx="14" fill="#ffffff" />
      <path
        d="M10 42c8-2 11-11 19-13 9-2 12 9 21 7 6-2 10-8 14-16"
        fill="none"
        stroke="#0f172a"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="42" r="3.2" fill="#0f172a" />
      <path
        d="M46 18l8 3-8 3-3 7-3-1 1-6-5-2-3 1-1-1 3-3 5-2-1-6 3-1z"
        fill="#0f172a"
      />
    </svg>
  );
}
