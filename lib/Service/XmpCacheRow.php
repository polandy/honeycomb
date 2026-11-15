<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** The values the client derived from one sidecar's or JPEG's XMP at one ETag; each is null when the source says nothing (ADR 0032). */
final readonly class XmpCacheRow implements \JsonSerializable {
	/** The highest rating XMP gives. */
	public const int MAX_RATING = 5;
	/** A refusal reason as the client names it, such as `not-utf-8`; the width of its column. */
	private const string REASON_PATTERN = '/^[a-z0-9-]{1,32}$/';
	/** Every field of a row, all required. */
	private const array FIELDS = ['fileId', 'kind', 'etag', 'reader', 'state', 'reason', 'rating', 'flag', 'colourLabel', 'keepRaw', 'tags'];

	/** @param ?list<string> $tags sorted */
	public function __construct(
		public int $fileId,
		public XmpSource $kind,
		public string $etag,
		public int $reader,
		public XmpReadState $state,
		public ?string $reason,
		public ?int $rating,
		public ?Flag $flag,
		public ?ColourLabel $colourLabel,
		public ?bool $keepRaw,
		public ?array $tags,
	) {
	}

	/**
	 * The row in a request item, every field required.
	 * @throws InvalidXmpCacheException for a missing or malformed field
	 */
	public static function fromRequest(mixed $item): self {
		if (!is_array($item) || array_diff(self::FIELDS, array_keys($item)) !== []) {
			throw new InvalidXmpCacheException('A cache row must be an object with ' . implode(', ', self::FIELDS));
		}
		$fileId = $item['fileId'];
		if (!is_int($fileId) || $fileId < 1) {
			throw new InvalidXmpCacheException('fileId must be a positive integer');
		}
		$etag = $item['etag'];
		if (!is_string($etag) || $etag === '' || strlen($etag) > VisualHash::MAX_ETAG_LENGTH) {
			throw new InvalidXmpCacheException("etag of file $fileId must be 1 to " . VisualHash::MAX_ETAG_LENGTH . ' characters');
		}
		$reader = $item['reader'];
		if (!is_int($reader) || $reader < 1) {
			throw new InvalidXmpCacheException("reader of file $fileId must be a positive integer");
		}
		$state = self::caseOf(XmpReadState::class, $item['state'], "state of file $fileId");
		$rating = $item['rating'];
		if ($rating !== null && (!is_int($rating) || $rating < 0 || $rating > self::MAX_RATING)) {
			throw new InvalidXmpCacheException("rating of file $fileId must be 0 to " . self::MAX_RATING . ' or null');
		}
		$keepRaw = $item['keepRaw'];
		if ($keepRaw !== null && !is_bool($keepRaw)) {
			throw new InvalidXmpCacheException("keepRaw of file $fileId must be a boolean or null");
		}
		return new self(
			$fileId,
			self::caseOf(XmpSource::class, $item['kind'], "kind of file $fileId"),
			$etag,
			$reader,
			$state,
			self::reasonOf($fileId, $state, $item['reason']),
			$rating,
			$item['flag'] === null ? null : self::caseOf(Flag::class, $item['flag'], "flag of file $fileId"),
			$item['colourLabel'] === null ? null : self::caseOf(ColourLabel::class, $item['colourLabel'], "colourLabel of file $fileId"),
			$keepRaw,
			$item['tags'] === null ? null : self::tagsOf($fileId, $item['tags']),
		);
	}

	/**
	 * @return array{fileId: int, kind: string, etag: string, reader: int, state: string, reason: ?string, rating: ?int, flag: ?string, colourLabel: ?string, keepRaw: ?bool, tags: ?list<string>}
	 */
	#[\Override]
	public function jsonSerialize(): array {
		return [
			'fileId' => $this->fileId,
			'kind' => $this->kind->value,
			'etag' => $this->etag,
			'reader' => $this->reader,
			'state' => $this->state->value,
			'reason' => $this->reason,
			'rating' => $this->rating,
			'flag' => $this->flag?->value,
			'colourLabel' => $this->colourLabel?->value,
			'keepRaw' => $this->keepRaw,
			'tags' => $this->tags,
		];
	}

	/**
	 * @template T of \BackedEnum
	 * @param class-string<T> $enum
	 * @return T
	 */
	private static function caseOf(string $enum, mixed $value, string $field): \BackedEnum {
		$case = is_string($value) ? $enum::tryFrom($value) : null;
		return $case ?? throw new InvalidXmpCacheException("$field is not one of its values");
	}

	/** A refusal has a reason, every other state none. */
	private static function reasonOf(int $fileId, XmpReadState $state, mixed $reason): ?string {
		if ($state !== XmpReadState::Refused) {
			return $reason === null ? null : throw new InvalidXmpCacheException("reason of file $fileId is only for a refused row");
		}
		if (!is_string($reason) || preg_match(self::REASON_PATTERN, $reason) !== 1) {
			throw new InvalidXmpCacheException("reason of file $fileId must be 1 to 32 lower-case letters, digits or dashes");
		}
		return $reason;
	}

	/** @return list<string> the tags by the rules of `PictureTags`, sorted */
	private static function tagsOf(int $fileId, mixed $tags): array {
		try {
			return PictureTags::fromRequest(['fileId' => $fileId, 'tags' => $tags])->tags;
		} catch (InvalidTagsException $e) {
			throw new InvalidXmpCacheException($e->getMessage(), 0, $e);
		}
	}
}
