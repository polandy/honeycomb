<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Immich;

use Psr\Log\AbstractLogger;

/**
 * A logger that keeps each line with its context placeholders filled in.
 * @psalm-suppress ImmutableDependency The stub marks the base immutable; the fake only records lines.
 */
final class FakeLogger extends AbstractLogger {
	/** @var list<array{level: string, line: string}> */
	public array $lines = [];

	/**
	 * @param mixed $level
	 * @param array<array-key, mixed> $context
	 */
	#[\Override]
	public function log($level, string|\Stringable $message, array $context = []): void {
		$replace = [];
		/** @var mixed $value */
		foreach ($context as $key => $value) {
			$replace['{' . $key . '}'] = is_scalar($value) ? (string)$value : get_debug_type($value);
		}
		$this->lines[] = ['level' => is_string($level) ? $level : get_debug_type($level), 'line' => strtr((string)$message, $replace)];
	}
}
