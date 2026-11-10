<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCP\Files\File;

/** A file that passed its check: where it goes, the file it replaces there, or that it is already there. */
final readonly class CheckedMove {
	public string $from;

	public function __construct(
		public File $source,
		public string $path,
		public ?File $replace,
		public bool $stays,
	) {
		$this->from = $source->getPath();
	}
}
