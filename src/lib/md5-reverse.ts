import { createHash } from "crypto";

export async function md5Reverse(req: { url: string | URL; method: string; params: { hash: string }},) {
    if (req.method === "OPTIONS") {
        return new Response(null, {
            status: 204,
            headers: {
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Max-Age": "86400",
            },
        });
    }

    const hash = req.params.hash.trim().toLowerCase() || "";

    if (!/^[0-9a-f]{32}$/.test(hash)) {
        return new Response(JSON.stringify({ error: "Invalid MD5" }), {
            status: 400,
            headers: {
                "Content-Type": "application/json",
            },
        });
    }

    const sites = [
        'https://md5.gromweb.com/?md5={hash}',
        `https://md5decrypt.net/en/?hash=${hash}`,
        `http://www.nitrxgen.net/md5db/${hash}.txt`,
    ];

    for (const siteUrl of sites) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 50000);

            const res = await fetch(siteUrl, {
                headers: { "User-Agent": "MD5-Tool-Proxy/2026" },
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!res.ok) continue;

            const text = (await res.text()).trim();

            if (
                !text ||
                ["not found", "no match", "could not"].some((phrase) =>
                    text.toLowerCase().includes(phrase)
                )
            ) {
                continue;
            }

            if (siteUrl.includes("nitrxgen") && text.length < 120) {
                const plaintext = text.trim();
                if (plaintext) {
                    return successResponse(plaintext, "nitrxgen");
                }
            }

            if (siteUrl.includes("gromweb") && text.includes("The MD5 hash")) {
                try {
                    const start = text.indexOf("The MD5 hash") + 140;
                    const end = text.indexOf("</p>", start);
                    if (start > 140 && end > start) {
                        let segment = text.slice(start, end).trim();

                        if (segment.includes("/?string=")) {
                            const parts = segment.split("/?string=");
                            const rawPlain = parts[1]?.split('"')[0] || "";
                            const plaintext = decodeURIComponent(
                                rawPlain.replace(/\+/g, " ").replace(/%20/g, " ")
                            );
                            if (plaintext) return successResponse(plaintext, "gromweb");
                        }
                        else {
                            const cleaned = segment
                                .replace(/^[["']/, "")
                                .replace(/["'\]]*$/, "")
                                .trim();
                            if (cleaned) return successResponse(cleaned, "gromweb");
                        }
                    }
                } catch (err) {
                    console.error("Gromweb parse error:", err);
                }
            }

            if (siteUrl.includes("gromweb")) {
                const regexMatch = text.match(/reversed into the string \[(.*?)\]/);
                if (regexMatch?.[1]) {
                    const plaintext = decodeURIComponent(
                        regexMatch[1].replace(/\+/g, " ")
                    );
                    if (plaintext) return successResponse(plaintext, "gromweb");
                }
            }

            const candidateRegex = /[\w !@#$%^&*()_+\-=\[\]{}|;:,.<>?\\'"\\/-]{2,60}/g;
            const candidates = text.match(candidateRegex) || [];

            for (const cand of candidates) {
                const plain = cand.trim();
                if (plain.length >= 1 && plain.length <= 60) {
                    const computed = createHash("md5").update(plain).digest("hex");
                    if (computed === hash) {
                        return successResponse(plain, "verification");
                    }
                }
            }
        } catch (err) {
            console.error(`Error fetching ${siteUrl}:`, err);
        }

        await new Promise((r) => setTimeout(r, 1400));
    }

    return new Response(
        JSON.stringify({
            success: false,
            plaintext: null,
            message: "Plaintext not found in available databases",
        }),
        {
            status: 200,
            headers: {
                "Content-Type": "application/json",
            },
        }
    );
}

function successResponse(plaintext: string, source: string) {
    return new Response(
        JSON.stringify({ success: true, plaintext, source }),
        {
            status: 200,
            headers: {
                "Content-Type": "application/json",
            },
        }
    );
}
