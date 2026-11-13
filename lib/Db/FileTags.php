<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Db;

use OCA\Honeycomb\Service\PictureTags;
use OCP\AppFramework\Db\Entity;
use OCP\DB\Types;

/**
 * A row of `honeycomb_file_tags`, the tags as a JSON list (ADR 0022).
 * @method string getUserId()
 * @method void setUserId(string $userId)
 * @method int getFileId()
 * @method void setFileId(int $fileId)
 * @method string getTags()
 * @method void setTags(string $tags)
 * @psalm-suppress PossiblyUnusedProperty, PropertyNotSetInConstructor Entity reads its properties by name and sets the id.
 */
final class FileTags extends Entity {
	protected ?string $userId = null;
	protected ?int $fileId = null;
	protected ?string $tags = null;

	public function __construct() {
		$this->addType('userId', Types::STRING);
		$this->addType('fileId', Types::BIGINT);
		$this->addType('tags', Types::TEXT);
	}

	public static function of(string $userId, PictureTags $picture): self {
		$row = new self();
		$row->setUserId($userId);
		$row->setFileId($picture->fileId);
		$row->setTags(json_encode($picture->tags, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
		return $row;
	}

	/** @throws \JsonException for a row not written by `of()` */
	public function toPictureTags(): PictureTags {
		/** @var list<string> $tags */
		$tags = json_decode($this->getTags(), true, 2, JSON_THROW_ON_ERROR);
		return new PictureTags($this->getFileId(), $tags);
	}
}
