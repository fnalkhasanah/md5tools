import Link from "next/link";

export function TopBar() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1100px] items-center justify-between px-5 md:px-8">
        <Link
          href="/"
          className="font-mono text-sm font-semibold tracking-tight text-foreground transition-colors hover:text-primary"
        >
          md5<span className="text-primary">.</span>tools
        </Link>
        <nav className="flex items-center gap-1">
          <Link
            href="/api-tester"
            className="rounded-md px-2.5 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            API Tester
          </Link>
        </nav>
      </div>
    </header>
  );
}
