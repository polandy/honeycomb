<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCP\Files\Search\ISearchComparison;

/** The search condition `fileid IN (...)`; the OCP has the interface only (ADR 0038). */
final class FileIdIn implements ISearchComparison {
	private const string FIELD = 'fileid';

	/** @var array<string, mixed> */
	private array $hints = [];

	/** @param list<int> $fileIds */
	public function __construct(
		private readonly array $fileIds,
	) {
	}

	#[\Override]
	public function getType(): string {
		return self::COMPARE_IN;
	}

	#[\Override]
	public function getField(): string {
		return self::FIELD;
	}

	#[\Override]
	public function getExtra(): string {
		return '';
	}

	/** @return list<int> */
	#[\Override]
	public function getValue(): array {
		return $this->fileIds;
	}

	#[\Override]
	public function getQueryHint(string $name, mixed $default): mixed {
		return $this->hints[$name] ?? $default;
	}

	#[\Override]
	public function setQueryHint(string $name, mixed $value): void {
		$this->hints[$name] = $value;
	}
}
