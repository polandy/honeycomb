<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Db;

use OCA\Honeycomb\Service\FolderSet;
use OCA\Honeycomb\Service\ResumePosition;
use OCP\AppFramework\Db\Entity;
use OCP\DB\Types;

/**
 * A row of `honeycomb_positions` (ADR 0012).
 * @method string getUserId()
 * @method void setUserId(string $userId)
 * @method string getFolderSetKey()
 * @method void setFolderSetKey(string $folderSetKey)
 * @method string getFolderSet()
 * @method void setFolderSet(string $folderSet)
 * @method int getFileId()
 * @method void setFileId(int $fileId)
 * @method int getDecided()
 * @method void setDecided(int $decided)
 * @method int getTotal()
 * @method void setTotal(int $total)
 * @method int getUpdatedAt()
 * @method void setUpdatedAt(int $updatedAt)
 * @psalm-suppress PossiblyUnusedProperty, PropertyNotSetInConstructor Entity reads its properties by name and sets the id.
 */
final class Position extends Entity {
	protected ?string $userId = null;
	protected ?string $folderSetKey = null;
	protected ?string $folderSet = null;
	protected ?int $fileId = null;
	protected ?int $decided = null;
	protected ?int $total = null;
	protected ?int $updatedAt = null;

	public function __construct() {
		$this->addType('userId', Types::STRING);
		$this->addType('folderSetKey', Types::STRING);
		$this->addType('folderSet', Types::TEXT);
		$this->addType('fileId', Types::BIGINT);
		$this->addType('decided', Types::INTEGER);
		$this->addType('total', Types::INTEGER);
		$this->addType('updatedAt', Types::BIGINT);
	}

	public static function of(string $userId, ResumePosition $position): self {
		$row = new self();
		$row->setUserId($userId);
		$row->setFolderSetKey($position->folderSet->key());
		$row->setFolderSet(json_encode($position->folderSet, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
		$row->setFileId($position->fileId);
		$row->setDecided($position->decided);
		$row->setTotal($position->total);
		$row->setUpdatedAt($position->updatedAt);
		return $row;
	}

	public function toPosition(): ResumePosition {
		/** @var array<array-key, mixed> $folderSet */
		$folderSet = json_decode($this->getFolderSet(), true, flags: JSON_THROW_ON_ERROR);
		return new ResumePosition(FolderSet::fromRequest($folderSet), $this->getFileId(), $this->getDecided(), $this->getTotal(), $this->getUpdatedAt());
	}
}
