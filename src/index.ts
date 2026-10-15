import * as cp from 'node:child_process'
import * as fs from 'node:fs'
import type { BinaryProfile } from './profiles'

export interface MultiToolMatchResult {
	toolName: string
	binaryPath: string
	paramsSummary: string
	matched: boolean
}

export function findExactMatchWithBinaries(
	originalCompressed: Buffer,
	uncompressedData: Buffer,
	profiles: BinaryProfile[],
	onAttempt?: (description: string, matched: boolean) => void,
): MultiToolMatchResult | null {
	// Базовые наборы параметров для разных этапов
	const allLevels = [9, 8, 7, 6, 5, 4, 3, 2, 1]
	const allMemLevels = [8, 9, 7, 6, 5]
	const allStrategies = [0, 1, 2, 3, 4]

	// ==========================================
	// ЭТАП 1: Строгое доверие метаданным
	// (windowBits = 15, уровень 1-2, memLevel = 8, стратегии 1 и 0)
	// ==========================================
	const phase1Levels = [1, 2]
	const phase1MemLevels = [8]
	const phase1Strategies = [1, 0]
	const phase1WindowBits = [15]

	for (const profile of profiles) {
		if (!fs.existsSync(profile.binaryPath) || profile.type !== 'zlib') {
			continue
		}

		for (const level of phase1Levels) {
			for (const memLevel of phase1MemLevels) {
				for (const strategy of phase1Strategies) {
					for (const windowBits of phase1WindowBits) {
						const matched = tryRunZlib(
							profile,
							level,
							memLevel,
							strategy,
							windowBits,
							originalCompressed,
							uncompressedData,
							'[Phase 1]',
							onAttempt,
						)
						if (matched) {
							return {
								toolName: profile.name,
								binaryPath: profile.binaryPath,
								paramsSummary: `level=${level}, memLevel=${memLevel}, strategy=${strategy}, windowBits=${windowBits} (Phase 1)`,
								matched: true,
							}
						}
					}
				}
			}
		}
	}

	// ==========================================
	// ЭТАП 2: Полная матрица параметров со стандартным окном
	// (windowBits = 15, но все уровни, memLevel и стратегии)
	// ==========================================
	for (const profile of profiles) {
		if (!fs.existsSync(profile.binaryPath)) continue

		if (profile.type === 'zlib') {
			for (const level of allLevels) {
				for (const memLevel of allMemLevels) {
					for (const strategy of allStrategies) {
						const windowBits = 15

						// Пропускаем то, что уже проверили на Этапе 1
						if (
							phase1Levels.includes(level) &&
							phase1MemLevels.includes(memLevel) &&
							phase1Strategies.includes(strategy)
						) {
							continue
						}

						const matched = tryRunZlib(
							profile,
							level,
							memLevel,
							strategy,
							windowBits,
							originalCompressed,
							uncompressedData,
							'[Phase 2]',
							onAttempt,
						)
						if (matched) {
							return {
								toolName: profile.name,
								binaryPath: profile.binaryPath,
								paramsSummary: `level=${level}, memLevel=${memLevel}, strategy=${strategy}, windowBits=${windowBits} (Phase 2)`,
								matched: true,
							}
						}
					}
				}
			}
		} else if (profile.type === 'zopfli') {
			// Zopfli проверяем на Этапе 2
			const iterationsList = [15, 50, 100, 250, 500]
			for (const iteration of iterationsList) {
				const matched = tryRunZopfli(
					profile,
					iteration,
					originalCompressed,
					uncompressedData,
					'[Phase 2]',
					onAttempt,
				)
				if (matched) {
					return {
						toolName: profile.name,
						binaryPath: profile.binaryPath,
						paramsSummary: `iterations=${iteration} (Phase 2)`,
						matched: true,
					}
				}
			}
		} else if (profile.type === 'libdeflate') {
			const libdeflateLevels = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
			for (const level of libdeflateLevels) {
				let matched = false
				try {
					const args = profile.getArgs({
						level,
						memLevel: 0,
						strategy: 0,
						windowBits: 15,
						iteration: 0,
					})
					const result = cp.spawnSync(profile.binaryPath, args, {
						input: uncompressedData,
						maxBuffer: 1024 * 1024 * 100,
					})

					if (!result.error && result.status === 0) {
						if (result.stdout.equals(originalCompressed)) {
							matched = true
						}
					}
				} catch (err) {}

				const desc = `[Libdeflate] ${profile.name} | level=${level}`
				if (onAttempt) onAttempt(desc, matched)

				if (matched) {
					return {
						toolName: profile.name,
						binaryPath: profile.binaryPath,
						paramsSummary: `level=${level}`,
						matched: true,
					}
				}
			}
		} else if (profile.type === 'miniz') {
			const minizLevels = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
			for (const level of minizLevels) {
				let matched = false
				try {
					const args = profile.getArgs({
						level,
						memLevel: 0,
						strategy: 0,
						windowBits: 15,
						iteration: 0,
					})
					const result = cp.spawnSync(profile.binaryPath, args, {
						input: uncompressedData,
						maxBuffer: 1024 * 1024 * 100,
					})

					if (!result.error && result.status === 0) {
						if (result.stdout.equals(originalCompressed)) {
							matched = true
						}
					}
				} catch (err) {}

				const desc = `[Miniz] ${profile.name} | level=${level}`
				if (onAttempt) onAttempt(desc, matched)

				if (matched) {
					return {
						toolName: profile.name,
						binaryPath: profile.binaryPath,
						paramsSummary: `level=${level}`,
						matched: true,
					}
				}
			}
		}
	}

	// ==========================================
	// ЭТАП 3: Перебор альтернативных (уменьшенных) размеров окна
	// (windowBits от 14 до 8 со всей матрицей параметров)
	// ==========================================
	const alternativeWindowBits = [14, 13, 12, 11, 10, 9, 8]

	for (const profile of profiles) {
		if (!fs.existsSync(profile.binaryPath) || profile.type !== 'zlib') {
			continue
		}

		for (const windowBits of alternativeWindowBits) {
			for (const level of allLevels) {
				for (const memLevel of allMemLevels) {
					for (const strategy of allStrategies) {
						const matched = tryRunZlib(
							profile,
							level,
							memLevel,
							strategy,
							windowBits,
							originalCompressed,
							uncompressedData,
							'[Phase 3]',
							onAttempt,
						)
						if (matched) {
							return {
								toolName: profile.name,
								binaryPath: profile.binaryPath,
								paramsSummary: `level=${level}, memLevel=${memLevel}, strategy=${strategy}, windowBits=${windowBits} (Phase 3)`,
								matched: true,
							}
						}
					}
				}
			}
		}
	}

	return null
}

// Вспомогательные функции для запуска
function tryRunZlib(
	profile: BinaryProfile,
	level: number,
	memLevel: number,
	strategy: number,
	windowBits: number,
	originalCompressed: Buffer,
	uncompressedData: Buffer,
	phaseTag: string,
	onAttempt?: (description: string, matched: boolean) => void,
): boolean {
	let matched = false
	try {
		const args = profile.getArgs({
			level,
			memLevel,
			strategy,
			windowBits,
			iteration: 0,
		})
		const result = cp.spawnSync(profile.binaryPath, args, {
			input: uncompressedData,
			maxBuffer: 1024 * 1024 * 100,
		})

		if (!result.error && result.status === 0) {
			if (result.stdout.equals(originalCompressed)) {
				matched = true
			}
		}
	} catch (err) {}

	const desc = `${phaseTag} ${profile.name} | lvl=${level}, mem=${memLevel}, strat=${strategy}, wBits=${windowBits}`
	if (onAttempt) onAttempt(desc, matched)

	return matched
}

function tryRunZopfli(
	profile: BinaryProfile,
	iteration: number,
	originalCompressed: Buffer,
	uncompressedData: Buffer,
	phaseTag: string,
	onAttempt?: (description: string, matched: boolean) => void,
): boolean {
	let matched = false
	try {
		const args = profile.getArgs({
			level: 0,
			memLevel: 0,
			strategy: 0,
			windowBits: 15,
			iteration,
		})
		const result = cp.spawnSync(profile.binaryPath, args, {
			input: uncompressedData,
			maxBuffer: 1024 * 1024 * 100,
		})

		if (!result.error && result.status === 0) {
			if (result.stdout.equals(originalCompressed)) {
				matched = true
			}
		}
	} catch (err) {}

	const desc = `${phaseTag} ${profile.name} | iterations=${iteration}`
	if (onAttempt) onAttempt(desc, matched)

	return matched
}
