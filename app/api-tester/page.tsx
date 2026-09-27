import { APITester } from "@/APITester";
import { TopBar } from "@/components/TopBar";

export default function APITesterPage() {
  return (
    <div className="min-h-[100dvh]">
      <TopBar />
      <div className="mx-auto max-w-[1100px] px-5 py-10 md:px-8 md:py-16">
        <h1 className="font-mono text-2xl font-semibold tracking-tight md:text-4xl">
          MD5 API Tester
        </h1>
        <p className="mt-3 max-w-[65ch] text-sm text-muted-foreground">
          Send a request to the reverse lookup endpoint and inspect the JSON
          response.
        </p>
        <div className="mt-8 rounded-lg border border-border bg-card p-6">
          <APITester />
        </div>
      </div>
    </div>
  );
}
