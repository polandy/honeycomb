<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Db;

/** One `INSERT` for `IDBConnection::executeStatement()`. */
final readonly class InsertStatement {
	/**
	 * @param list<scalar|null> $params
	 * @param list<mixed> $types `IQueryBuilder::PARAM_*`
	 */
	public function __construct(
		public string $sql,
		public array $params,
		public array $types,
	) {
	}
}
