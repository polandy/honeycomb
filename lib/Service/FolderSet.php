<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** The ticked folders of one cull, sorted and each once; every folder below them too with `subfolders`. */
final readonly class FolderSet implements \JsonSerializable {
	/** Bounds the stored JSON; a picker never ticks this many. */
	public const int MAX_FOLDERS = 1_000;

	/** @var list<string> */
	public array $paths;

	/** @param list<string> $paths */
	public function __construct(
		array $paths,
		public bool $subfolders,
	) {
		$paths = array_values(array_unique($paths));
		sort($paths, SORT_STRING);
		$this->paths = $paths;
	}

	/**
	 * The folder set in a request, shaped as `FolderSet` in `src/logic/folder-set.ts`.
	 * @param array<array-key, mixed> $request
	 * @throws InvalidPositionException for missing, malformed or too many paths
	 */
	public static function fromRequest(array $request): self {
		$paths = $request['paths'] ?? null;
		$subfolders = $request['subfolders'] ?? null;
		if (!is_array($paths) || !array_is_list($paths) || $paths === [] || count($paths) > self::MAX_FOLDERS) {
			throw new InvalidPositionException('folderSet.paths must list 1 to ' . self::MAX_FOLDERS . ' paths');
		}
		foreach ($paths as $path) {
			if (!is_string($path) || in_array('..', explode('/', $path), true) || str_contains($path, "\0")) {
				throw new InvalidPositionException('folderSet.paths must be folder paths without ..');
			}
		}
		if (!is_bool($subfolders)) {
			throw new InvalidPositionException('folderSet.subfolders must be true or false');
		}
		/** @var list<string> $paths */
		return new self($paths, $subfolders);
	}

	/** The SHA-256 of `folderSetKey()` in `src/logic/folder-set.ts`: the same set gives the same key. */
	public function key(): string {
		return hash('sha256', json_encode([$this->paths, $this->subfolders], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
	}

	/** @return array{paths: list<string>, subfolders: bool} */
	#[\Override]
	public function jsonSerialize(): array {
		return ['paths' => $this->paths, 'subfolders' => $this->subfolders];
	}
}
