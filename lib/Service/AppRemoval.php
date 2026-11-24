<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** Removes honeycomb from the database: its tables and its rows in the tables Nextcloud shares between apps (ADR 0053). */
interface AppRemoval {
	/**
	 * The honeycomb tables that exist, by name without the instance's prefix.
	 * @return list<string>
	 * @throws \OCP\DB\Exception
	 */
	public function tables(): array;

	/**
	 * Drops every honeycomb table and deletes the app's migrations, preferences, background jobs and config; returns the dropped tables.
	 * @return list<string>
	 * @throws \OCP\DB\Exception
	 */
	public function remove(): array;
}
