<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Controller;

use OCP\AppFramework\Http;
use OCP\AppFramework\Http\JSONResponse;

/** Why a route failed; the values are the wire form of the error code (APP-004). */
enum ApiError: string {
	case Unauthorized = 'unauthorized';
	case Request = 'request';
	case FolderNotFound = 'folder-not-found';
	case ImageNotFound = 'image-not-found';
	case FolderNotReadable = 'folder-not-readable';
	case ImageNotReadable = 'image-not-readable';
	case TrashBinDisabled = 'trash-bin-disabled';

	/**
	 * The HTTP status the route answers with.
	 * @return 400|401|403|404|409
	 */
	public function status(): int {
		return match ($this) {
			self::Unauthorized => Http::STATUS_UNAUTHORIZED,
			self::Request => Http::STATUS_BAD_REQUEST,
			self::FolderNotFound, self::ImageNotFound => Http::STATUS_NOT_FOUND,
			self::FolderNotReadable, self::ImageNotReadable => Http::STATUS_FORBIDDEN,
			self::TrashBinDisabled => Http::STATUS_CONFLICT,
		};
	}

	/**
	 * The answer: the status and the body `{"error": code}` plus the route's own fields.
	 * @param array<string, string> $fields
	 */
	public function response(array $fields = []): JSONResponse {
		return new JSONResponse(['error' => $this->value, ...$fields], $this->status());
	}
}
