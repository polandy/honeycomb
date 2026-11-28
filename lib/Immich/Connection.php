<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Immich;

/** One user's Immich connection from the connections file (IMMICH-001). */
final class Connection {
	public function __construct(
		public readonly string $id,
		public readonly string $user,
		public readonly string $label,
		public readonly string $url,
		public readonly string $keyFile,
		public readonly bool $picksAsFavorites,
	) {
	}

	/**
	 * What the browser may see: never the key file.
	 * @return array{id: string, label: string, url: string, picksAsFavorites: bool}
	 */
	public function toArray(): array {
		return ['id' => $this->id, 'label' => $this->label, 'url' => rtrim($this->url, '/'), 'picksAsFavorites' => $this->picksAsFavorites];
	}
}
