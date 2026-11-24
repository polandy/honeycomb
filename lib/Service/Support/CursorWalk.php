<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service\Support;

use OCA\Honeycomb\AppInfo\Application;
use OCP\IAppConfig;

/** Walks a table by row id from a stored cursor, a bounded number of chunks per run. */
final class CursorWalk {
	/** Rows per chunk; also Oracle's limit of an `IN` list. */
	private const int CHUNK = 1_000;

	private const int CHUNKS_PER_RUN = 100;

	/**
	 * Hands each chunk `$page` reads after the cursor under `$cursorKey` to `$remove`, and returns what it removed.
	 * @param \Closure(int, int): array<int, int> $page at most the given number of rows after the given row id, keyed by row id in row id order
	 * @param \Closure(array<int, int>): int $remove removes what it must of a chunk and returns how many
	 * @throws \OCP\DB\Exception after keeping the cursor of the last finished chunk
	 */
	public static function walk(IAppConfig $config, string $cursorKey, \Closure $page, \Closure $remove): int {
		$afterId = $config->getValueInt(Application::APP_ID, $cursorKey, lazy: true);
		$removed = 0;
		try {
			for ($chunk = 0; $chunk < self::CHUNKS_PER_RUN; ++$chunk) {
				$rows = $page($afterId, self::CHUNK);
				$removed += $rows === [] ? 0 : $remove($rows);
				if (count($rows) < self::CHUNK) {
					// The end of the table: the next run starts again from the first row.
					$afterId = 0;
					break;
				}
				$afterId = (int)array_key_last($rows);
			}
		} finally {
			$config->setValueInt(Application::APP_ID, $cursorKey, $afterId, lazy: true);
		}
		return $removed;
	}
}
