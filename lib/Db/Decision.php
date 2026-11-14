<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Db;

use OCA\Honeycomb\Service\ColourLabel;
use OCA\Honeycomb\Service\Flag;
use OCA\Honeycomb\Service\PictureDecision;
use OCP\AppFramework\Db\Entity;
use OCP\DB\QueryBuilder\IQueryBuilder;
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

	/** The table's columns and their parameter types, for `InsertStatements`. */
	public const array COLUMNS = [
		'user_id' => IQueryBuilder::PARAM_STR,
		'file_id' => IQueryBuilder::PARAM_INT,
		'rating' => IQueryBuilder::PARAM_INT,
		'colour_label' => IQueryBuilder::PARAM_STR,
		'flag' => IQueryBuilder::PARAM_STR,
		'keep_raw' => IQueryBuilder::PARAM_BOOL,
	];

	/** @return array<key-of<self::COLUMNS>, int|string|bool|null> */
	public static function row(string $userId, PictureDecision $decision): array {
		return [
			'user_id' => $userId,
			'file_id' => $decision->fileId,
			'rating' => $decision->rating,
			'colour_label' => $decision->colourLabel?->value,
			'flag' => $decision->flag->value,
			'keep_raw' => $decision->keepRaw,
		];
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
