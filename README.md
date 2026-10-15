# zlib-fingerprint-cli

A command-line interface (CLI) tool written in TypeScript designed to detect exact `zlib`/`deflate` implementations and compression parameters for **bit-exact reproduction** of compressed streams from uncompressed data.

---

## Features

* **Multi-Implementation Support:** Tests multiple compression binaries and versions (e.g., standard `zlib`, `zlib-ng`, `Zopfli`).
* **Brute-Force Fingerprinting:** Iterates through compression levels (1–9) and custom flags via `stdin`.
* **Bit-Exact Comparison:** Validates candidate outputs byte-for-byte against the original compressed stream.

---

## Project Structure

```text
zlib-fingerprint-cli/
├── bin/
│   └── cli.js            # CLI entrypoint (shebang)
├── src/
│   ├── index.ts          # Core matching logic and profile definitions
│   └── main.ts           # CLI argument parser and runner
├── binaries/             # Directory for external binaries (zlib wrappers, zopfli, etc.)
│   ├── README.md
│   └── download-binaries.sh
├── package.json
├── tsconfig.json
└── README.md

```

---

## Prerequisites

* **Node.js** (v18 or higher recommended)
* **pnpm** (v8 or v9+)

---

## Installation & Setup

1. **Clone or download** the repository.
2. **Install dependencies** using `pnpm`:
```bash
pnpm install

```


3. **Build the project**:
```bash
pnpm run build

```


4. **Link globally** (optional, for convenient execution anywhere):
```bash
pnpm link --global

```



---

## Usage

If you linked the package globally, run it directly from your terminal:

```bash
zlib-fingerprint <path_to_compressed_file> <path_to_uncompressed_file>

```

Alternatively, run it via local context:

```bash
pnpm zlib-fingerprint compressed.zls original.bin

```

### Example Output:

```text
Starting parameter search for file: compressed.zls
> Testing implementation: zlib 1.2.8...
> Testing implementation: Zopfli 1.0.3...

[SUCCESS] Bit-exact match found!
- Implementation: zlib 1.2.8
- Binary path: /path/to/project/binaries/zlib-1.2.8.exe
- Compression level: 6

```

---

## Windows & MSYS2 Usage Special Features

If you are building binaries or running the tool on Windows via **MSYS2** (e.g., using `MINGW64`, `UCRT64`, or `CLANG64` terminals), consider the following features:

1. **Required Toolchain Packages:**
Before running the automatic download/compilation script, ensure you have GCC and the MSYS2 zlib development package installed in your shell:
```bash
pacman -S --needed base-devel mingw-w64-x86_64-toolchain mingw-w64-x86_64-zlib

```

for UCRT64
```bash
pacman -S --needed base-devel mingw-w64-ucrt-x86_64-toolchain mingw-w64-ucrt-x86_64-zlib

```


2. **Automatic Executable Extensions (`.exe`):**
The `binaries/download-binaries.sh` script automatically detects MSYS2 environments and appends the `.exe` extension to compiled binaries (`zlib-1.2.8.exe`, `zopfli-1.0.3.exe`), ensuring Node.js (`child_process.spawnSync`) can invoke them natively on Windows.
3. **Binary Mode Stream Handling (`_setmode`):**
The custom C wrappers generated for MSYS2 include `_setmode(_fileno(stdin), _O_BINARY)` configuration. This forces Windows to handle `stdin` and `stdout` in pure binary mode, preventing unintended Carriage Return (`\r`) translations that would otherwise corrupt byte-for-byte stream verification.

---

## License

MIT
