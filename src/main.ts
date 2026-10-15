import * as fs from 'node:fs'
import * as path from 'node:path'
import * as zlib from 'node:zlib'
import { findExactMatchWithBinaries } from './index'
import { getProfiles } from './profiles'

interface ZlibHeaderInfo {
	compressionMethod: number
	windowSize: number
	windowBits: number
	headerValid: boolean
	hasDictionary: boolean
	dictionaryId?: number
	flevelHint: number
	flevelDescription: string
}

const FLEVEL_DESCRIPTIONS = [
	'Fastest algorithm',
	'Fast algorithm',
	'Default algorithm',
	'Maximum compression',
]

const printZlibHeaderInfo = ($: ZlibHeaderInfo) => {
	console.log('\n=== Zlib Header Metadata (RFC 1950) ===')
	console.log(
		`- Header Valid (FCHECK) : ${$.headerValid ? 'Yes (OK)' : 'No (Corrupt or custom)'}`,
	)
	console.log(`- Compression Method    : ${$.compressionMethod}`)
	console.log(
		`- Window Size           : ${$.windowSize} bytes (windowBits = ${$.windowBits})`,
	)
	console.log(
		`- Preset Dictionary     : ${$.hasDictionary ? `Yes (ID: ${$.dictionaryId})` : 'None'}`,
	)
	console.log(
		`- Compression Level Hint: ${$.flevelDescription} (${$.flevelHint})`,
	)
	console.log('========================================\n')
}

/**
 * Детальный разбор заголовка Zlib (RFC 1950) и первичный анализ DEFLATE-блоков
 */
function analyzeZlibStream(buffer: Buffer): ZlibHeaderInfo {
	if (buffer.length < 2)
		throw new Error('Buffer is too short to contain a valid zlib header.')

	const cmf = buffer[0]
	const flg = buffer[1]

	const headerValid = (cmf * 256 + flg) % 31 === 0
	const compressionMethod = cmf & 0x0f
	const cinfo = (cmf >> 4) & 0x0f

	// Размер окна zlib (от 256 до 32768 байт). windowBits = cinfo + 8
	const windowBits = cinfo + 8
	const windowSize = 1 << windowBits

	const hasDictionary = (flg & 0x20) !== 0
	const flevelHint = (flg >> 6) & 0x03

	let dictionaryId: number | undefined = undefined
	if (hasDictionary && buffer.length >= 6) {
		dictionaryId = buffer.readUInt32BE(2)
	}

	return {
		compressionMethod,
		windowSize,
		windowBits,
		headerValid,
		hasDictionary,
		dictionaryId,
		flevelHint,
		flevelDescription: FLEVEL_DESCRIPTIONS[flevelHint] ?? 'Unknown',
	}
}

/**
 * Быстрый сканер первых DEFLATE-блоков для оценки структуры
 */
function analyzeDeflateBlocks(buffer: Buffer): void {
	console.log('\n--- Deflate Stream Structure (First blocks scan) ---')
	if (buffer.length > 2) {
		const firstByte = buffer[2]
		const bfinal = firstByte & 0x01
		const btype = (firstByte >> 1) & 0x03

		const btypeNames = [
			'Stored (uncompressed)',
			'Fixed Huffman',
			'Dynamic Huffman',
			'Reserved (invalid)',
		]
		console.log(`- First Block BFINAL : ${bfinal}`)
		console.log(`- First Block BTYPE  : ${btype} (${btypeNames[btype]})`)
	}
	console.log('--------------------------------------------------\n')
}

export function runCli() {
	const args = process.argv.slice(2)

	const verboseIndex = args.findIndex(
		(arg) => arg === '--verbose' || arg === '-v',
	)
	const isVerbose = verboseIndex !== -1
	if (isVerbose) args.splice(verboseIndex, 1)

	if (args.length < 1) {
		console.log(
			'Usage: zlib-fingerprint [--verbose | -v] <compressed_file>',
		)
		process.exit(1)
	}

	const compressedPath = path.resolve(args[0])

	if (!fs.existsSync(compressedPath)) {
		console.error(`Error: Compressed file not found: ${compressedPath}`)
		process.exit(1)
	}

	const originalCompressed = fs.readFileSync(compressedPath)

	console.log(`Analyzing zlib stream for: ${path.basename(compressedPath)}`)

	try {
		printZlibHeaderInfo(analyzeZlibStream(originalCompressed))
	} catch (err: any) {
		console.warn(
			`Warning: Could not fully parse zlib header: ${err.message}`,
		)
	}

	console.log(`Decompressing stream to extract uncompressed data...`)

	let uncompressedData: Buffer
	try {
		uncompressedData = zlib.inflateSync(originalCompressed)
	} catch (err: any) {
		console.error(
			`Error: Failed to inflate zlib stream. Ensure the file contains a valid zlib-compressed stream.\nDetails: ${err.message}`,
		)
		process.exit(1)
	}

	console.log(
		`Successfully unpacked: ${uncompressedData.length} bytes of raw data.\n`,
	)

	const binariesDir = path.join(__dirname, '../binaries')
	const profiles = getProfiles(binariesDir)

	console.log(
		`Starting parameter search across ${profiles.length} profiles...`,
	)

	const match = findExactMatchWithBinaries(
		originalCompressed,
		uncompressedData,
		profiles,
		(description, matched) => {
			if (isVerbose) {
				const status = matched ? 'MATCH FOUND! 🎉' : 'mismatch'
				console.log(`  [Attempt] ${description} -> ${status}`)
			}
		},
	)

	if (match) {
		console.log('\n[SUCCESS] Bit-exact match found!')
		console.log(`- Implementation: ${match.toolName}`)
		console.log(`- Binary path: ${match.binaryPath}`)
		console.log(`- Parameters: ${match.paramsSummary}`)
	} else {
		console.log(
			'\n[RESULT] No bit-exact match was found by any of the available binaries.',
		)
	}
}
