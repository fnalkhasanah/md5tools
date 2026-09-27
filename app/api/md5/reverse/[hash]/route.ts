import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const UA = "MD5-Tool-Proxy/2026";
const SOURCE_TIMEOUT = 15000;

// Fetched pages are scraped for plaintext candidates, and every candidate is
// re-hashed  and compared to the query hash before it is trusted. A source can
// therefore only ever yield a real hit, never a false positive.
const CANDIDATE_RE = /[\w !@#$%^&*()_+\-=\[\]{}|;:,.<>?\\'"\\/-]{2,60}/g;
const NEGATIVE_PHRASES = ["not found", "no match", "could not"];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ hash: string }> }
) {
  const { hash } = await params;
  const normalized = (hash || "").trim().toLowerCase();

  if (!/^[0-9a-f]{32}$/.test(normalized)) {
    return NextResponse.json({ error: "Invalid MD5 hash" }, { status: 400 });
  }

  const hash = normalized;

  // Cheapest and largest databases first. hashes.com needs a free API key and
  // is skipped entirely when unset (its keyless response is an error JSON that
  // the verification pass rejects anyway).
  const sources: Array<{ name: string; fetch: () => Promise<string | null> }> =
    [];

  if (process.env.HASHES_COM_API_KEY) {
    sources.push({
      name: "hashes.com",
      fetch: () =>
        fetchText(
        `https://hashes.com/en/api/search?hash=${hash}&key=${process.env.HASHES_COM_API_KEY}`
      ),
    });
  }

  sources.push(
    { name: "binsec", fetch: () => fetchBinsec(hash) },
    { name: "gromweb", fetch: () => fetchText(`https://md5.gromweb.com/?md5=${hash}`) },
    { name: "md5decrypt", fetch: () => fetchText(`https://md5decrypt.net/en/?hash=${hash}`) }
  );

  for (const source of sources) {
    const text = await source.fetch().catch(() => null);

    if (!text) continue;
    if (NEGATIVE_PHRASES.some((phrase) => text.toLowerCase().includes(phrase))) {
      continue;
    }

    if (source.name === "gromweb") {
      const parsed = parseGromweb(text);
      if (parsed) {
        return NextResponse.json({
          success: true,
          plaintext: parsed,
          source: "gromweb",
        });
      }
    }

    const verified = verifyCandidates(text, hash);
    if (verified) {
      return NextResponse.json({
        success: true,
        plaintext: verified,
        source: source.name,
      });
    }

    await new Promise((r) => setTimeout(r, 1400));
  }

  return NextResponse.json({
    success: false,
    plaintext: null,
    message: "Plaintext not found in available databases",
  });
}

/** GET a source page and return the trimmed body, or null on any failure. */
async function fetchText(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SOURCE_TIMEOUT);

    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) return null;
    return (await res.text()).trim();
  } catch (err) {
    console.error(`Error fetching ${url}:`, err);
    return null;
  }
}

/**
 * binsec.tools sits behind a Django CSRF handshake: the form token posted back
 * must be the masked token from the same response that set the CSRF cookie, and
 * the field names are prefixed with a per-form id. Both are scraped from the
 * form on every request, so this keeps working if either rotates.
 */
async function fetchBinsec(hash: string): Promise<string | null> {
  const pageUrl = "https://binsec.tools/lookup/hash/";

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SOURCE_TIMEOUT);

    const getRes = await fetch(pageUrl, {
      headers: { "User-Agent": UA },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!getRes.ok) return null;

    const cookie = (getRes.headers.getSetCookie() ?? [])
      .map((cookie) => cookie.split(";")[0])
      .join("; ");

    const html = await getRes.text();

    const csrf = html.match(
      /name="csrfmiddlewaretoken" value="([^"]+)"/
    )?.[1];
    const prefix = html.match(/name="(h[0-9a-f]{32})-lookup"/)?.[1];

    if (!csrf || !prefix) return null;

    const body = new URLSearchParams({
      csrfmiddlewaretoken: csrf,
      [`${prefix}-lookup`]: hash,
      [`${prefix}-hash_type`]: "md5",
      Search: "submit",
    });

    const postController = new AbortController();
    const postTimeoutId = setTimeout(
      () => postController.abort(),
      SOURCE_TIMEOUT
    );

    const postRes = await fetch(pageUrl, {
      method: "POST",
      headers: {
        "User-Agent": UA,
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: pageUrl,
        Cookie: cookie,
      },
      body: body.toString(),
      signal: postController.signal,
    });

    clearTimeout(postTimeoutId);

    if (!postRes.ok) return null;
    return (await postRes.text()).trim();
  } catch (err) {
    console.error("Error fetching binsec.tools:", err);
    return null;
  }
}

/** Gromweb embeds the reversed string in its own markup; parse it directly. */
function parseGromweb(text: string): string | null {
  try {
    if (text.includes("The MD5 hash")) {
      const start = text.indexOf("The MD5 hash") + 140;
      const end = text.indexOf("</p>", start);
      if (start > 140 && end > start) {
        const segment = text.slice(start, end).trim();

        if (segment.includes("/?string=")) {
          const rawPlain = segment.split("/?string=")[1]?.split('"')[0] || "";
          const plaintext = decodeURIComponent(
            rawPlain.replace(/\+/g, " ").replace(/%20/g, " ")
          );
          if (plaintext) return plaintext;
        }

        const cleaned = segment
          .replace(/^[["']/, "")
          .replace(/["'\]]*$/, "")
          .trim();
        if (cleaned) return cleaned;
      }
    }
  } catch (err) {
    console.error("Gromweb parse error:", err);
  }

  const regexMatch = text.match(/reversed into the string \[(.*?)\]/);
  if (regexMatch?.[1]) {
    const plaintext = decodeURIComponent(regexMatch[1].replace(/\+/g, " "));
    if (plaintext) return plaintext;
  }

  return null;
}

/** Scrape plaintext candidates from any page and return the one that matches. */
function verifyCandidates(text: string, hash: string): string | null {
  const candidates = text.match(CANDIDATE_RE) || [];

  for (const cand of candidates) {
    const plain = cand.trim();
    if (plain.length >= 1 && plain.length <= 60) {
      const computed = createHash("md5").update(plain).digest("hex");
      if (computed === hash) return plain;
    }
  }

  return null;
}
