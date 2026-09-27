# md5.tools

An MD5 hashing and reverse-lookup tool built with Next.js 15, React 19, TypeScript, and Tailwind CSS.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Features

- **Reverse MD5 lookup** - recover the plaintext behind an MD5 hash using public wordlist databases
- **Text to MD5** - hash any text, live as you type
- **File to MD5** - compute a file checksum, with drag-and-drop
- **Hash comparison** - check whether two hashes match, case-insensitive

## API

### `GET /api/md5/reverse/[hash]`

Cracks an MD5 hash against several public sources, in order:

1. `hashes.com` (only when `HASHES_COM_API_KEY` is set)
2. `binsec.tools`
3. `md5.gromweb.com`
4. `md5decrypt.net`

Every candidate scraped from a source is re-hashed and compared to the query hash
before it is returned, so a source can only ever produce a verified hit.

```jsonc
// GET /api/md5/reverse/5f4dcc3b5aa765d61d8327deb882cf99
{ "success": true, "plaintext": "password", "source": "gromweb" }

// GET /api/md5/reverse/00000000000000000000000000000000
{ "success": false, "plaintext": null, "message": "Plaintext not found in available databases" }
```

Returns `400` when `[hash]` is not a valid 32-character hex string.

### Optional: hashes.com API key

Sign up at [hashes.com](https://hashes.com) for a free API key, then add it to
`.env.local`:

```
HASHES_COM_API_KEY=your-key-here
```

Without the key, hashes.com is skipped entirely and the remaining sources are used.

## Pages

- `/` - the MD5 tool (reverse lookup, text and file hashing, comparison)
- `/api-tester` - interactive playground for the reverse-lookup API

## Technology Stack

- Next.js 15 (App Router + Pages Router)
- React 19
- TypeScript
- Tailwind CSS
- shadcn/ui components
