<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Search;

use OCP\Files\Search\ISearchOperator;
use OCP\Files\Search\ISearchQuery;
use OCP\IUser;

/** A file-cache search below a folder, across every mount in it, in file id order. */
final class FileSearchQuery implements ISearchQuery {
	public function __construct(
		private ISearchOperator $operation,
		private int $limit,
		private int $offset,
		private IUser $user,
	) {
	}

	#[\Override]
	public function getSearchOperation(): ISearchOperator {
		return $this->operation;
	}

	#[\Override]
	public function getLimit(): int {
		return $this->limit;
	}

	#[\Override]
	public function getOffset(): int {
		return $this->offset;
	}

	/** @return list<FileIdOrder> */
	#[\Override]
	public function getOrder(): array {
		return [new FileIdOrder()];
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
