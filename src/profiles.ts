import * as path from 'node:path'

const zlibGetArgs = ({
	level,
	memLevel,
	strategy,
	windowBits,
}: {
	level: number
	memLevel: number
	strategy: number
	windowBits: number
}) => [`${level}`, `${memLevel}`, `${strategy}`, `${windowBits}`]

export interface BinaryProfile {
	name: string
	binaryPath: string
	type: 'zlib' | 'zopfli' | 'libdeflate' | 'miniz'
	getArgs: (params: {
		level: number
		memLevel: number
		strategy: number
		windowBits: number
		iteration: number
	}) => string[]
}

export function getProfiles(binariesDir: string): BinaryProfile[] {
	const ext = process.platform === 'win32' ? '.exe' : ''

	return [
		{
			name: 'zlib 1.2.8',
			binaryPath: path.join(binariesDir, `zlib-1.2.8${ext}`),
			type: 'zlib',
			getArgs: zlibGetArgs,
		},
		{
			name: 'zlib-ng 2.2.1',
			binaryPath: path.join(binariesDir, `zlib-ng-2.2.1${ext}`),
			type: 'zlib',
			getArgs: zlibGetArgs,
		},
		{
			name: 'Zopfli 1.0.3',
			binaryPath: path.join(binariesDir, `zopfli-1.0.3${ext}`),
			type: 'zopfli',
			getArgs: ({ iteration }) => [
				'--deflate',
				`--iterations=${iteration}`,
			],
		},
		{
			name: 'libdeflate 1.20',
			binaryPath: path.join(binariesDir, `libdeflate-1.20${ext}`),
			type: 'libdeflate',
			getArgs: ({ level }) => [`${level}`],
		},
		{
			name: 'miniz 3.1.2',
			binaryPath: path.join(binariesDir, `miniz-3.1.2${ext}`),
			type: 'miniz',
			getArgs: ({ level }) => [`${level}`],
		},
		{
			name: 'zlib 1.3.1',
			binaryPath: path.join(binariesDir, `zlib-1.3.1${ext}`),
			type: 'zlib',
			getArgs: zlibGetArgs,
		},
		{
			name: 'zlib 1.2.5',
			binaryPath: path.join(binariesDir, `zlib-1.2.5${ext}`),
			type: 'zlib',
			getArgs: zlibGetArgs,
		},
		{
			name: 'zlib 1.2.3',
			binaryPath: path.join(binariesDir, `zlib-1.2.3${ext}`),
			type: 'zlib',
			getArgs: zlibGetArgs,
		},
		{
			name: 'zlib 1.2.7',
			binaryPath: path.join(binariesDir, `zlib-1.2.7${ext}`),
			type: 'zlib',
			getArgs: zlibGetArgs,
		},
		{
			name: 'zlib 1.2.11',
			binaryPath: path.join(binariesDir, `zlib-1.2.11${ext}`),
			type: 'zlib',
			getArgs: zlibGetArgs,
		},
	]
}
