<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Immich;

use OCP\AppFramework\Http;

/** Why an Immich call failed; the values are the wire form of the error code (IMMICH-001). */
enum ImmichError: string {
	case NotConfigured = 'not-configured';
	case ConnectionsFile = 'connections-file';
	case UnknownConnection = 'unknown-connection';
	case UnknownAsset = 'unknown-asset';
	case Key = 'key';
	case Unreachable = 'unreachable';
	case Refused = 'refused';
	case Scope = 'scope';
	case Version = 'version';
	case Request = 'request';

	/**
	 * The HTTP status the route answers with.
	 * @return 400|403|404|502|503
	 */
	public function status(): int {
		return match ($this) {
			self::NotConfigured, self::UnknownConnection, self::UnknownAsset => Http::STATUS_NOT_FOUND,
			self::ConnectionsFile => Http::STATUS_SERVICE_UNAVAILABLE,
			self::Key, self::Unreachable, self::Refused, self::Version => Http::STATUS_BAD_GATEWAY,
			self::Scope => Http::STATUS_FORBIDDEN,
			self::Request => Http::STATUS_BAD_REQUEST,
		};
	}
}
