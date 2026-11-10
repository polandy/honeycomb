<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Db;

use OCA\Honeycomb\Service\ColourLabel;
use OCA\Honeycomb\Service\Flag;
use OCA\Honeycomb\Service\PictureDecision;
use OCP\AppFramework\Db\Entity;
use OCP\DB\Types;

/**
 * A row of `honeycomb_decisions` (ADR 0012).
 * @method string getUserId()
 * @method void setUserId(string $userId)
 * @method int getFileId()
 * @method void setFileId(int $fileId)
 * @method int getRating()
 * @method void setRating(int $rating)
 * @method ?string getColourLabel()
 * @method void setColourLabel(?string $colourLabel)
 * @method string getFlag()
 * @method void setFlag(string $flag)
 * @method bool getKeepRaw()
 * @method void setKeepRaw(bool $keepRaw)
 * @psalm-suppress PossiblyUnusedProperty, PropertyNotSetInConstructor Entity reads its properties by name and sets the id.
 */
final class Decision extends Entity {
	protected ?string $userId = null;
	protected ?int $fileId = null;
	protected ?int $rating = null;
	protected ?string $colourLabel = null;
	protected ?string $flag = null;
	protected ?bool $keepRaw = null;

	public function __construct() {
		$this->addType('userId', Types::STRING);
		$this->addType('fileId', Types::BIGINT);
		$this->addType('rating', Types::SMALLINT);
		$this->addType('colourLabel', Types::STRING);
		$this->addType('flag', Types::STRING);
		$this->addType('keepRaw', Types::BOOLEAN);
	}

	public static function of(string $userId, PictureDecision $decision): self {
		$row = new self();
		$row->setUserId($userId);
		$row->setFileId($decision->fileId);
		$row->setRating($decision->rating);
		$row->setColourLabel($decision->colourLabel?->value);
		$row->setFlag($decision->flag->value);
		$row->setKeepRaw($decision->keepRaw);
		return $row;
	}

	public function toDecision(): PictureDecision {
		$colourLabel = $this->getColourLabel();
		return new PictureDecision(
			$this->getFileId(),
			$this->getRating(),
			$colourLabel === null ? null : ColourLabel::from($colourLabel),
			Flag::from($this->getFlag()),
			$this->getKeepRaw(),
		);
	}
}
