<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** The tags of one file, sorted, each once (ADR 0022). */
final readonly class PictureTags implements \JsonSerializable {
	/** The longest tag in characters, the width of the tag list column. */
	public const int MAX_LENGTH = 255;
	/** The most tags one file may have. */
	public const int MAX_TAGS = 100;
	/** Separates the names of a tag, as `digiKam:TagsList` does. */
	private const string TAG_SEPARATOR = '/';
	/** Refused in a name because `lr:hierarchicalSubject` separates with it. */
	private const string HIERARCHY_SEPARATOR = '|';

	/** @param list<string> $tags */
	public function __construct(
		public int $fileId,
		public array $tags,
	) {
	}

	/**
	 * The tags in a request item, both fields required, sorted.
	 * @throws InvalidTagsException for a missing field, a malformed tag, a tag twice or too many tags
	 */
	public static function fromRequest(mixed $item): self {
		if (!is_array($item)) {
			throw new InvalidTagsException('A tag item must be an object');
		}
		$fileId = $item['fileId'] ?? null;
		$tags = $item['tags'] ?? null;
		if (!is_int($fileId) || $fileId < 1) {
			throw new InvalidTagsException('fileId must be a positive integer');
		}
		if (!is_array($tags) || !array_is_list($tags) || count($tags) > self::MAX_TAGS) {
			throw new InvalidTagsException("tags of file $fileId must be a list of at most " . self::MAX_TAGS);
		}
		foreach ($tags as $tag) {
			if (!is_string($tag) || !self::isTag($tag)) {
				throw new InvalidTagsException("tags of file $fileId must be names separated by /");
			}
		}
		/** @var list<string> $tags */
		if (count(array_unique($tags)) !== count($tags)) {
			throw new InvalidTagsException("tags of file $fileId must each appear once");
		}
		sort($tags, SORT_STRING);
		return new self($fileId, $tags);
	}

	/** Whether the text is a tag as `tagOf()` in `src/logic/tag.ts` writes it. */
	private static function isTag(string $tag): bool {
		if (mb_strlen($tag) > self::MAX_LENGTH) {
			return false;
		}
		foreach (explode(self::TAG_SEPARATOR, $tag) as $name) {
			if ($name === '' || trim($name) !== $name || str_contains($name, self::HIERARCHY_SEPARATOR)) {
				return false;
			}
		}
		return true;
	}

	/** @return array{fileId: int, tags: list<string>} */
	#[\Override]
	public function jsonSerialize(): array {
		return ['fileId' => $this->fileId, 'tags' => $this->tags];
	}
}
