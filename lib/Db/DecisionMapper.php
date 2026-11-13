<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Db;

use OCA\Honeycomb\Service\DecisionStore;
use OCA\Honeycomb\Service\PictureDecision;
use OCP\AppFramework\Db\QBMapper;
use OCP\AppFramework\Db\TTransactional;
use OCP\IDBConnection;

/** @template-extends QBMapper<Decision> */
final class DecisionMapper extends QBMapper implements DecisionStore {
	use FileRowQueries;
	use TTransactional;

	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it. */
	public function __construct(IDBConnection $db) {
		parent::__construct($db, 'honeycomb_decisions', Decision::class);
	}

	#[\Override]
	public function find(string $userId, array $fileIds): array {
		return array_map(static fn (array $row): PictureDecision => Decision::fromRow($row)->toDecision(), $this->findFileRows($userId, $fileIds));
	}

	#[\Override]
	public function replace(string $userId, array $fileIds, array $decisions): void {
		$this->atomic(function () use ($userId, $fileIds, $decisions): void {
			$this->deleteFileRows($userId, $fileIds);
			foreach ($decisions as $decision) {
				$this->insert(Decision::of($userId, $decision));
			}
		}, $this->db);
	}

	#[\Override]
	public function forgetUser(string $userId): void {
		$this->deleteUserRows($this->getTableName(), $userId);
	}
}
