<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** What is known of a job's runs: the last run, whether it failed, and the last error with its time (APP-003). */
final readonly class JobStatus {
	public function __construct(
		public ?int $lastRun,
		public bool $failed,
		public ?string $lastError,
		public ?int $lastErrorAt,
	) {
	}
}
