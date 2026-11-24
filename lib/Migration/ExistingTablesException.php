<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Migration;

/** honeycomb tables exist already, so the baseline cannot create them (ADR 0055). */
final class ExistingTablesException extends \RuntimeException {
	/** @param non-empty-list<string> $tables the existing tables, without prefix */
	public function __construct(array $tables) {
		parent::__construct(sprintf(
			'honeycomb was installed before 0.2.0 and cannot update: the tables %s exist already. '
			. 'Install honeycomb again as docs/user/admin/updating.md, section "Installed before 0.2.0", describes.',
			implode(', ', $tables),
		));
	}
}
