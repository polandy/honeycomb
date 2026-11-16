<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** The ticked folders of one cull, sorted and each once; every folder below them too with `subfolders`, but the excluded ones (ADR 0035). */
final readonly class FolderSet implements \JsonSerializable {
	/** Bounds the stored JSON; a picker never ticks this many. */
	public const int MAX_FOLDERS = 1_000;

	/** @var list<string> */
	public array $paths;

	/** @var list<string> Folders *Include subfolders* leaves out, each with everything below it but the ticked folders there. */
	public array $excluded;

	/**
	 * @param list<string> $paths
	 * @param list<string> $excluded
	 */
	public function __construct(
		array $paths,
		public bool $subfolders,
		array $excluded = [],
	) {
		$this->paths = self::sorted($paths);
		$this->excluded = self::sorted($excluded);
	}

	/**
	 * The folder set in a request, shaped as `FolderSet` in `src/logic/folder-set.ts`.
	 * @param array<array-key, mixed> $request
	 * @throws InvalidPositionException for missing, malformed or too many paths
	 */
	public static function fromRequest(array $request): self {
		$paths = self::folderPaths($request['paths'] ?? null);
		$subfolders = $request['subfolders'] ?? null;
		$excluded = self::folderPaths($request['excluded'] ?? []);
		if ($paths === null || $paths === []) {
			throw new InvalidPositionException('folderSet.paths must list 1 to ' . self::MAX_FOLDERS . ' folder paths without ..');
		}
		if (!is_bool($subfolders)) {
			throw new InvalidPositionException('folderSet.subfolders must be true or false');
		}
		if ($excluded === null) {
			throw new InvalidPositionException('folderSet.excluded must list at most ' . self::MAX_FOLDERS . ' folder paths without ..');
		}
		return new self($paths, $subfolders, $excluded);
	}

	/**
	 * The folder paths `$value` lists, at most `MAX_FOLDERS`, each without `..` or a NUL byte; null for anything else.
	 * @return list<string>|null
	 */
	public static function folderPaths(mixed $value): ?array {
		if (!is_array($value) || !array_is_list($value) || count($value) > self::MAX_FOLDERS) {
			return null;
		}
		foreach ($value as $path) {
			if (!is_string($path) || in_array('..', explode('/', $path), true) || str_contains($path, "\0")) {
				return null;
			}
		}
		/** @var list<string> $value */
		return $value;
	}

	/** The SHA-256 of `folderSetKey()` in `src/logic/folder-set.ts`: the same set gives the same key (ADR 0034, 0035). */
	public function key(): string {
		$paths = $this->subfolders ? array_values(array_filter($this->paths, fn (string $path): bool => $this->tickAbove($path) === null)) : $this->paths;
		$excluded = $this->effectiveExclusions();
		$key = $excluded === [] ? [$paths, $this->subfolders] : [$paths, $this->subfolders, $excluded];
		return hash('sha256', json_encode($key, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
	}

	/**
	 * The excluded folders that leave something out: each below a ticked folder, none inside another.
	 * @return list<string>
	 */
	private function effectiveExclusions(): array {
		if (!$this->subfolders) {
			return [];
		}
		return array_values(array_filter($this->excluded, fn (string $path): bool => !in_array($path, $this->paths, true) && $this->tickAbove($path) !== null));
	}

	/** The nearest ticked folder above `$path` with no excluded folder between them; null when none. */
	private function tickAbove(string $path): ?string {
		for ($cut = strrpos($path, '/'); $cut !== false; $cut = $cut === 0 ? false : strrpos(substr($path, 0, $cut), '/')) {
			$above = substr($path, 0, $cut);
			if (in_array($above, $this->paths, true)) {
				return $above;
			}
			if (in_array($above, $this->excluded, true)) {
				return null;
			}
		}
		return null;
	}

	/**
	 * @param list<string> $paths
	 * @return list<string>
	 */
	private static function sorted(array $paths): array {
		$paths = array_values(array_unique($paths));
		sort($paths, SORT_STRING);
		return $paths;
	}

	/** @return array{paths: list<string>, subfolders: bool, excluded?: list<string>} */
	#[\Override]
	public function jsonSerialize(): array {
		$json = ['paths' => $this->paths, 'subfolders' => $this->subfolders];
		return $this->excluded === [] ? $json : [...$json, 'excluded' => $this->excluded];
	}
}
