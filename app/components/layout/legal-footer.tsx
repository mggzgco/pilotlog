export function LegalFooter({ className }: { className?: string }) {
  const year = new Date().getFullYear();
  return (
    <div
      className={[
        "text-center text-xs text-slate-500 dark:text-slate-400",
        className ?? ""
      ].join(" ")}
    >
      <p>© {year} Gezellig Dynamics LLC. All rights reserved.</p>
      <p>FlightTraks is a brand name and trademark of Gezellig Dynamics LLC.</p>
    </div>
  );
}
