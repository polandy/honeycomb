<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** Where the one flag of each file is kept, by file id (ADR 0040). */
interface FlagStore extends FileRowStore, UserRowStore {
	/**
	 * The rows of `$fileIds` that have one, by file id.
	 * @param list<int> $fileIds
	 * @return array<int, FileFlag>
	 * @throws \OCP\DB\Exception
	 */
	public function find(array $fileIds): array;

	/**
	 * Writes each flag as its file's whole state, in one transaction.
	 * @param list<FileFlag> $flags
	 * @throws \OCP\DB\Exception
	 */
	public function save(array $flags): void;

	/**
	 * Inserts the flags whose file has no row yet, in one transaction.
	 * @param list<FileFlag> $flags
	 * @return list<int> the file ids inserted
	 * @throws \OCP\DB\Exception
	 */
	public function takeOver(array $flags): array;

	/**
	 * Removes the rows of `$fileIds`.
	 * @param list<int> $fileIds
	 * @throws \OCP\DB\Exception
	 */
	public function remove(array $fileIds): void;
}
