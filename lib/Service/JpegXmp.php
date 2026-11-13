<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** Finds the standard XMP packet a JPEG embeds, walking its segment headers up to the image data (ADR 0023). */
final class JpegXmp {
	private const string START_OF_IMAGE = "\xFF\xD8";
	private const string XMP_HEADER = "http://ns.adobe.com/xap/1.0/\x00";
	private const int MARKER = 0xFF;
	private const int APP1 = 0xE1;
	private const int START_OF_SCAN = 0xDA;
	private const int END_OF_IMAGE = 0xD9;
	private const int TEMPORARY = 0x01;
	private const int FIRST_RESTART = 0xD0;
	private const int LAST_RESTART = 0xD7;
	private const int LENGTH_BYTES = 2;

	/**
	 * The packet of the first standard XMP segment before the start of scan; null without one or for a malformed JPEG.
	 * @param resource $stream
	 */
	public function packet($stream): ?string {
		if ($this->read($stream, strlen(self::START_OF_IMAGE)) !== self::START_OF_IMAGE) {
			return null;
		}
		while (($marker = $this->marker($stream)) !== null && $marker !== self::START_OF_SCAN && $marker !== self::END_OF_IMAGE) {
			if ($marker === self::TEMPORARY || ($marker >= self::FIRST_RESTART && $marker <= self::LAST_RESTART)) {
				continue;
			}
			$payload = $this->payload($stream);
			if ($payload === null) {
				return null;
			}
			if ($marker === self::APP1 && str_starts_with($payload, self::XMP_HEADER)) {
				return substr($payload, strlen(self::XMP_HEADER));
			}
		}
		return null;
	}

	/**
	 * The next marker after its fill bytes; null where none belongs.
	 * @param resource $stream
	 */
	private function marker($stream): ?int {
		if ($this->read($stream, 1) !== chr(self::MARKER)) {
			return null;
		}
		do {
			$byte = $this->read($stream, 1);
		} while ($byte === chr(self::MARKER));
		return $byte === null ? null : ord($byte);
	}

	/**
	 * A segment's payload after its length; null when cut off or the length is below its own size.
	 * @param resource $stream
	 */
	private function payload($stream): ?string {
		$length = $this->read($stream, self::LENGTH_BYTES);
		if ($length === null) {
			return null;
		}
		$size = (ord($length[0]) << 8 | ord($length[1])) - self::LENGTH_BYTES;
		return $size < 0 ? null : $this->read($stream, $size);
	}

	/**
	 * Exactly `$length` bytes; null at the end of the stream.
	 * @param resource $stream
	 */
	private function read($stream, int $length): ?string {
		if ($length === 0) {
			return '';
		}
		$bytes = stream_get_contents($stream, $length);
		return $bytes !== false && strlen($bytes) === $length ? $bytes : null;
	}
}
