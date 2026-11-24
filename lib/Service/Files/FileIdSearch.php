<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service\Files;

use OCP\Files\Search\ISearchQuery;
use OCP\IUser;

/** A folder search for the files with the given ids, unlimited and unordered; the OCP has the interface only (ADR 0038). */
final class FileIdSearch implements ISearchQuery {
	private readonly FileIdIn $fileIdIn;

	/** @param list<int> $fileIds */
	public function __construct(
		private readonly IUser $user,
		array $fileIds,
	) {
		$this->fileIdIn = new FileIdIn($fileIds);
	}

	#[\Override]
	public function getSearchOperation(): FileIdIn {
		return $this->fileIdIn;
	}

	#[\Override]
	public function getLimit(): int {
		return 0;
	}

	#[\Override]
	public function getOffset(): int {
		return 0;
	}

	#[\Override]
	public function getOrder(): array {
		return [];
	}

	#[\Override]
	public function getUser(): IUser {
		return $this->user;
	}

	#[\Override]
	public function limitToHome(): bool {
		return false;
	}

	#[\Override]
	public function getSelectFields(): array {
		return [];
	}
}
