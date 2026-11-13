<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

/** An in-memory stream for tests of code that reads a file's stream. */
final class MemoryStream {
	/**
	 * A stream holding the bytes, at their start.
	 * @return resource
	 * @psalm-suppress ForbiddenCode An in-memory stream, not a user file.
	 */
	public static function of(string $bytes) {
		$stream = fopen('php://memory', 'r+');
		if ($stream === false) {
			throw new \RuntimeException('No in-memory stream');
		}
		fwrite($stream, $bytes);
		rewind($stream);
		return $stream;
	}
}
