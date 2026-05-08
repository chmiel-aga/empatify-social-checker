import Link from "next/link";

export function Nav({ active }: { active: "results" | "trends" }) {
  return (
    <header className="mb-8">
      <h1 className="text-2xl font-semibold tracking-tight">
        Empatify Social Checker
      </h1>
      <p className="text-sm text-muted mt-1">
        Statystyki rolek po 24h i po 7d, agregowane między platformami.
      </p>
      <nav className="flex gap-1 text-sm bg-card rounded-lg p-1 border border-border w-fit mt-4">
        <NavLink href="/" active={active === "results"} label="Wyniki" />
        <NavLink href="/trends" active={active === "trends"} label="Trendy" />
      </nav>
    </header>
  );
}

function NavLink({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`px-3 py-1 rounded transition-colors ${
        active ? "bg-foreground text-background" : "text-muted hover:text-foreground"
      }`}
    >
      {label}
    </Link>
  );
}
