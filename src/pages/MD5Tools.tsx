"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { md5 } from "js-md5";
import {
  AlertCircle,
  ArrowLeftRight,
  Check,
  Copy,
  FileCheck2,
  Search,
  Upload,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TopBar } from "@/components/TopBar";

const HASH_RE = /^[0-9a-f]{32}$/;

export default function MD5Tool() {
  const [textInput, setTextInput] = useState("");
  const [compareA, setCompareA] = useState("");
  const [compareB, setCompareB] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  // File hashing
  const [fileName, setFileName] = useState("");
  const [fileHash, setFileHash] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reverse lookup
  const [lookupHash, setLookupHash] = useState("");
  const [lookupResult, setLookupResult] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Live-derived values: no submit button needed for pure-local work.
  const textHash = textInput ? md5(textInput) : "";
  const match =
    compareA && compareB
      ? compareA.trim().toLowerCase() === compareB.trim().toLowerCase()
      : null;

  const copy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const hashFile = async (file: File) => {
    setFileName(file.name);
    setFileError(null);
    setFileHash("");
    try {
      const buffer = await file.arrayBuffer();
      setFileHash(md5(buffer));
    } catch (err) {
      console.error(err);
      setFileError("Could not read that file.");
    }
  };

  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) hashFile(file);
  };

  const handleReverseLookup = async () => {
    const hash = lookupHash.trim().toLowerCase();

    if (!HASH_RE.test(hash)) {
      setLookupError("Enter a valid 32-character hexadecimal MD5 hash.");
      setLookupResult(null);
      return;
    }

    setLookupLoading(true);
    setLookupError(null);
    setLookupResult(null);

    try {
      const res = await fetch(`/api/md5/reverse/${hash}`);
      const data = await res.json();

      if (data.success && data.plaintext) {
        setLookupResult(data.plaintext);
      } else {
        setLookupError(data.error || "Plaintext not found.");
      }
    } catch (err) {
      console.error(err);
      setLookupError("Lookup request failed.");
    } finally {
      setLookupLoading(false);
    }
  };

  const HashRow = ({
    value,
    id,
    copiedId,
  }: {
    value: string;
    id: string;
    copiedId: string | null;
  }) => (
    <div className="flex items-center gap-2">
      <Input
        value={value}
        readOnly
        className="font-mono text-sm text-muted-foreground"
      />
      <Button
        variant="outline"
        size="icon"
        onClick={() => copy(value, id)}
        aria-label="Copy hash"
        className="shrink-0 active:translate-y-px"
      >
        {copiedId === id ? (
          <Check className="size-4 text-primary" />
        ) : (
          <Copy className="size-4" />
        )}
      </Button>
    </div>
  );

  return (
    <div className="min-h-[100dvh]">
      <TopBar />
      <div className="mx-auto max-w-[1100px] px-5 pb-24 md:px-8">
        <header className="pt-10 pb-8 md:pt-16">
          <h1 className="font-mono text-3xl font-semibold tracking-tight md:text-5xl">
            Hash, crack, compare.
          </h1>
          <p className="mt-3 max-w-[65ch] text-sm text-muted-foreground md:text-base">
            Reverse lookups, live text hashing, and file checksums in one place.
          </p>
        </header>

        <div className="grid gap-4 md:auto-rows-fr md:grid-cols-3">
          {/* Hero cell: reverse lookup, 2x2 */}
          <section className="tile-grid overflow-hidden rounded-lg border border-border bg-popover p-6 md:col-span-2 md:row-span-2">
            <div className="flex h-full flex-col">
              <h2 className="font-mono text-sm font-medium text-foreground">
                Reverse MD5 lookup
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Find the original text behind a hash. Queries public rainbow
                tables.
              </p>

              <div className="mt-6 space-y-2">
                <Label htmlFor="lookup-hash" className="text-xs text-muted-foreground">
                  Hash to crack
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="lookup-hash"
                    placeholder="5f4dcc3b5aa765d61d8327deb882cf99"
                    value={lookupHash}
                    onChange={(e) => setLookupHash(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleReverseLookup();
                    }}
                    className="font-mono text-sm"
                    maxLength={32}
                  />
                  <Button
                    onClick={handleReverseLookup}
                    disabled={lookupLoading || !lookupHash.trim()}
                    className="active:translate-y-px"
                  >
                    <Search className="size-4" />
                    Crack
                  </Button>
                </div>
              </div>

              <div className="mt-6 min-h-[88px] flex-1">
                {lookupLoading && (
                  <div className="space-y-3">
                    <div className="shimmer h-4 w-32 rounded" />
                    <div className="shimmer h-12 w-full rounded" />
                  </div>
                )}

                {!lookupLoading && lookupError && (
                  <Alert variant="destructive">
                    <AlertCircle className="size-4" />
                    <AlertTitle>No result</AlertTitle>
                    <AlertDescription>{lookupError}</AlertDescription>
                  </Alert>
                )}

                {!lookupLoading && !lookupError && lookupResult && (
                  <div className="space-y-2">
                    <span className="font-mono text-xs text-primary">
                      Plaintext recovered
                    </span>
                    <div className="flex items-center gap-2">
                      <Input
                        value={lookupResult}
                        readOnly
                        className="border-primary/30 font-mono text-base text-foreground"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copy(lookupResult, "lookup")}
                        aria-label="Copy plaintext"
                        className="shrink-0 active:translate-y-px"
                      >
                        {copied === "lookup" ? (
                          <Check className="size-4 text-primary" />
                        ) : (
                          <Copy className="size-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {!lookupLoading && !lookupError && !lookupResult && (
                  <p className="text-xs text-muted-foreground">
                    Paste a 32-character hex hash above, then run the lookup.
                  </p>
                )}
              </div>

              <p className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground">
                Success depends on the hash existing in a public database. No
                guarantee of a match.
              </p>
            </div>
          </section>

          {/* Text to MD5 */}
          <section className="flex flex-col rounded-lg border border-border bg-card p-6">
            <h2 className="font-mono text-sm font-medium text-foreground">
              Text to MD5
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Hashes as you type.
            </p>
            <div className="mt-4 space-y-2">
              <Label htmlFor="text-input" className="sr-only">
                Input text
              </Label>
              <Textarea
                id="text-input"
                placeholder="Type or paste text here."
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                className="min-h-[96px] resize-y"
              />
            </div>
            <div className="mt-4">
              {textHash ? (
                <HashRow value={textHash} id="text" copiedId={copied} />
              ) : (
                <p className="text-xs text-muted-foreground">
                  The digest appears here.
                </p>
              )}
            </div>
          </section>

          {/* File to MD5 */}
          <section className="flex flex-col rounded-lg border border-border bg-card p-6">
            <h2 className="font-mono text-sm font-medium text-foreground">
              File to MD5
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Checksum of any local file.
            </p>
            <Input
              type="file"
              ref={fileInputRef}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                const file = e.target.files?.[0];
                if (file) hashFile(file);
              }}
              className="hidden"
            />
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border px-4 py-7 text-center transition-colors hover:border-primary/60 hover:bg-accent/40"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
            >
              <Upload
                className={`size-5 transition-colors ${
                  dragging ? "text-primary" : "text-muted-foreground"
                }`}
              />
              <span className="text-xs text-muted-foreground">
                Drop a file or browse
              </span>
            </label>
            <div className="mt-4">
              {fileError && (
                <p className="text-xs text-destructive">{fileError}</p>
              )}
              {!fileError && fileHash && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <FileCheck2 className="size-4 shrink-0 text-primary" />
                    <span className="truncate">{fileName}</span>
                  </div>
                  <HashRow value={fileHash} id="file" copiedId={copied} />
                </div>
              )}
              {!fileError && !fileHash && (
                <p className="text-xs text-muted-foreground">
                  No file selected yet.
                </p>
              )}
            </div>
          </section>

          {/* Compare hashes, full width */}
          <section className="rounded-lg border border-border bg-card p-6 md:col-span-3">
            <div className="flex flex-col gap-6 md:flex-row md:items-start">
              <div className="md:w-1/3">
                <h2 className="font-mono text-sm font-medium text-foreground">
                  Compare hashes
                </h2>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Case-insensitive, checked live.
                </p>
              </div>
              <div className="flex-1 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label
                      htmlFor="compare-a"
                      className="text-xs text-muted-foreground"
                    >
                      Hash A
                    </Label>
                    <Input
                      id="compare-a"
                      placeholder="d41d8cd98f00b204e9800998ecf8427e"
                      value={compareA}
                      onChange={(e) => setCompareA(e.target.value)}
                      className="font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="compare-b"
                      className="text-xs text-muted-foreground"
                    >
                      Hash B
                    </Label>
                    <Input
                      id="compare-b"
                      placeholder="d41d8cd98f00b204e9800998ecf8427e"
                      value={compareB}
                      onChange={(e) => setCompareB(e.target.value)}
                      className="font-mono text-sm"
                    />
                  </div>
                </div>

                {match === null ? (
                  <p className="text-xs text-muted-foreground">
                    Fill both hashes to compare them.
                  </p>
                ) : match ? (
                  <div className="inline-flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm text-primary">
                    <Check className="size-4" />
                    Identical
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-sm text-destructive">
                    <ArrowLeftRight className="size-4" />
                    Different
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
