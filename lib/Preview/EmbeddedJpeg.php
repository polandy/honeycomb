<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Preview;

/** Finds the JPEG previews a RAW file embeds by walking their marker segments. */
final class EmbeddedJpeg {
	private const string START = "\xFF\xD8\xFF";
	private const int END_OF_IMAGE = 0xD9;
	private const int START_OF_SCAN = 0xDA;
	private const int FILL = 0xFF;
	private const int STUFFED_ZERO = 0x00;
	private const int FIRST_RESTART = 0xD0;
	private const int LAST_RESTART = 0xD7;
	/** Baseline, extended and progressive frames; lossless ones hold sensor data, not a preview. */
	private const array DECODABLE_FRAMES = [0xC0, 0xC1, 0xC2];

	/** The largest complete, decodable JPEG embedded in `$bytes`, or null when there is none. */
	public function largest(string $bytes): ?string {
		$largest = null;
		$offset = 0;
		while (($start = strpos($bytes, self::START, $offset)) !== false) {
			$end = $this->endOf($bytes, $start);
			if ($end === null) {
				$offset = $start + 1;
				continue;
			}
			if ($largest === null || $end - $start > strlen($largest)) {
				$largest = substr($bytes, $start, $end - $start);
			}
			$offset = $end;
		}
		return $largest;
	}

	/** The offset after the end marker of the JPEG starting at `$start`, or null when it is not one. */
	private function endOf(string $bytes, int $start): ?int {
		$length = strlen($bytes);
		$position = $start + 2;
		$decodable = false;
		$scanned = false;
		while ($position + 2 <= $length) {
			if (ord($bytes[$position]) !== self::FILL) {
				return null;
			}
			$marker = ord($bytes[$position + 1]);
			if ($marker === self::FILL) {
				$position++;
				continue;
			}
			if ($marker === self::END_OF_IMAGE) {
				return $decodable && $scanned ? $position + 2 : null;
			}
			if ($position + 4 > $length) {
				return null;
			}
			$segmentLength = (ord($bytes[$position + 2]) << 8) | ord($bytes[$position + 3]);
			if ($segmentLength < 2) {
				return null;
			}
			$decodable = $decodable || in_array($marker, self::DECODABLE_FRAMES, true);
			$position += 2 + $segmentLength;
			if ($marker === self::START_OF_SCAN) {
				$scanned = true;
				$position = $this->afterScan($bytes, $position);
				if ($position === null) {
					return null;
				}
			}
		}
		return null;
	}

	/** The offset of the first marker after the entropy-coded data at `$position`, or null at the end. */
	private function afterScan(string $bytes, int $position): ?int {
		$length = strlen($bytes);
		while ($position < $length && ($fill = strpos($bytes, "\xFF", $position)) !== false && $fill + 1 < $length) {
			$next = ord($bytes[$fill + 1]);
			if ($next !== self::STUFFED_ZERO && ($next < self::FIRST_RESTART || $next > self::LAST_RESTART)) {
				return $fill;
			}
			$position = $fill + 2;
		}
		return null;
	}
}
