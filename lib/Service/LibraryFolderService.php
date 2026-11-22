<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCP\AppFramework\Utility\ITimeFactory;
use OCP\Files\Folder;
use OCP\IUser;

/** Scans the folders of a library root into summaries and lists them with the user's live decisions (FOLDERS-001). */
final class LibraryFolderService {
	/** Folders a scan takes per call. */
	public const int SCAN_BATCH = 50;
	/** The largest and the default page of the list. */
	public const int MAX_LIMIT = 200;
	private const string OWN_MOUNT = '';
	private const string NUMBER = '/^\d+$/';

	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it. */
	public function __construct(
		private UserFolderResolver $folders,
		private LibraryFiles $files,
		private FolderSummaryStore $summaries,
		private FolderDoneStore $done,
		private CaptureTimes $captureTimes,
		private ITimeFactory $time,
	) {
	}

	/**
	 * Summarises the next batch of folders below `$root` without a fresh summary, in path order.
	 * @return array{scanning: array{done: int, total: int}}
	 * @throws InvalidLibraryRequestException for a root outside the user's own storage
	 * @throws FolderNotReadableException when the user may not read the root
	 */
	public function scan(IUser $user, string $root): array {
		$folders = $this->files->folders($this->root($user, $root));
		$summaries = $this->summaries->find(array_map(static fn (LibraryFolder $folder): int => $folder->fileId, $folders));
		$stale = array_values(array_filter($folders, static fn (LibraryFolder $folder): bool => !self::isFresh($folder, $summaries)));
		usort($stale, static fn (LibraryFolder $a, LibraryFolder $b): int => strcmp($a->path, $b->path));
		$batch = array_slice($stale, 0, self::SCAN_BATCH);
		if ($batch !== []) {
			$this->summaries->replace($this->summarise($batch));
		}
		return ['scanning' => ['done' => count($folders) - count($stale) + count($batch), 'total' => count($folders)]];
	}

	/**
	 * One page, by file id, of the folders below `$root` that have a summary with photos.
	 * @return array{folders: list<array<string, mixed>>, next: ?int, scanning: ?array{done: int, total: int}}
	 * @throws InvalidLibraryRequestException for a root outside the user's own storage or a malformed page
	 * @throws FolderNotReadableException when the user may not read the root
	 */
	public function list(IUser $user, string $root, string $after, string $limit): array {
		$afterId = self::number($after, 0, 'after');
		$pageSize = self::number($limit, self::MAX_LIMIT, 'limit');
		if ($pageSize < 1 || $pageSize > self::MAX_LIMIT) {
			throw new InvalidLibraryRequestException('limit must be from 1 to ' . self::MAX_LIMIT);
		}
		$rootPath = self::rootPath($root);
		$folders = $this->files->folders($this->root($user, $root));
		$summaries = $this->summaries->find(array_map(static fn (LibraryFolder $folder): int => $folder->fileId, $folders));
		$fresh = count(array_filter($folders, static fn (LibraryFolder $folder): bool => self::isFresh($folder, $summaries)));
		$listed = array_values(array_filter($folders, static fn (LibraryFolder $folder): bool => $folder->fileId > $afterId && ($summaries[$folder->fileId]->photos ?? 0) > 0));
		usort($listed, static fn (LibraryFolder $a, LibraryFolder $b): int => $a->fileId <=> $b->fileId);
		$page = array_slice($listed, 0, $pageSize);
		$ids = array_map(static fn (LibraryFolder $folder): int => $folder->fileId, $page);
		$done = $ids === [] ? [] : $this->done->find($ids);
		$decisions = $ids === [] ? [] : FolderDecisions::of($this->files->decisionRows($user->getUID(), $ids));
		return [
			'folders' => array_map(fn (LibraryFolder $folder): array => self::row($rootPath, $folder, $summaries[$folder->fileId], $decisions[$folder->fileId] ?? null, $done[$folder->fileId] ?? null), $page),
			'next' => count($listed) > $pageSize ? $listed[$pageSize - 1]->fileId : null,
			'scanning' => $fresh === count($folders) ? null : ['done' => $fresh, 'total' => count($folders)],
		];
	}

	/**
	 * The summaries of `$folders`, at the etags they were listed with.
	 * @param non-empty-list<LibraryFolder> $folders
	 * @return list<FolderSummary>
	 */
	private function summarise(array $folders): array {
		$byFolder = [];
		$photos = $this->files->photoFiles(array_map(static fn (LibraryFolder $folder): int => $folder->fileId, $folders));
		$times = $this->captureTimes->of(array_column($photos, 'fileId'));
		foreach ($photos as $photo) {
			$byFolder[$photo['parent']][] = ['name' => $photo['name'], 'size' => $photo['size'], 'mtime' => $photo['mtime'], 'captureTime' => $times[$photo['fileId']] ?? null];
		}
		$now = $this->time->getTime();
		$extensions = PairingExtensions::defaults();
		return array_map(static function (LibraryFolder $folder) use ($byFolder, $now, $extensions): FolderSummary {
			$tally = FolderTally::of($byFolder[$folder->fileId] ?? [], $extensions);
			return new FolderSummary($folder->fileId, $folder->etag, $tally['photos'], $tally['bytes'], $tally['rawBytes'], $tally['bursts'], $tally['oldest'], $tally['newest'], $tally['lastActivity'], $now);
		}, $folders);
	}

	/**
	 * @param ?array{picked: int, rejected: int, doneUnflagged: int} $decisions
	 * @return array<string, mixed>
	 */
	private static function row(string $rootPath, LibraryFolder $folder, FolderSummary $summary, ?array $decisions, ?FolderDone $done): array {
		$decisions ??= ['picked' => 0, 'rejected' => 0, 'doneUnflagged' => 0];
		return [
			'fileId' => $folder->fileId,
			'root' => $rootPath,
			'path' => $rootPath === '/' ? ($folder->path === '' ? '/' : $folder->path) : $rootPath . $folder->path,
			'photos' => $summary->photos,
			'bytes' => $summary->bytes,
			'rawBytes' => $summary->rawBytes,
			'bursts' => $summary->bursts,
			'oldest' => $summary->oldest,
			'newest' => $summary->newest,
			'lastActivity' => $summary->lastActivity,
			'picked' => $decisions['picked'],
			'rejected' => $decisions['rejected'],
			'undecided' => max(0, $summary->photos - $decisions['picked'] - $decisions['rejected'] - $decisions['doneUnflagged']),
			'permissions' => $folder->permissions,
			'done' => $done === null ? null : ['by' => $done->userId, 'at' => $done->doneAt, 'photos' => $done->photos],
		];
	}

	/**
	 * The root folder, rechecked: a folder of the user's own storage.
	 * @throws InvalidLibraryRequestException
	 * @throws FolderNotReadableException
	 */
	private function root(IUser $user, string $root): Folder {
		try {
			$folder = $this->folders->folder($user, self::rootPath($root));
		} catch (FolderNotFoundException) {
			throw new InvalidLibraryRequestException('root must be a folder of your own files');
		}
		if ($folder->getMountPoint()->getMountType() !== self::OWN_MOUNT) {
			throw new InvalidLibraryRequestException('root must be a folder of your own files');
		}
		return $folder;
	}

	/** The root as `/Photos`, `/` for the user folder. */
	private static function rootPath(string $root): string {
		return '/' . trim($root, '/');
	}

	/** @param array<int, FolderSummary> $summaries */
	private static function isFresh(LibraryFolder $folder, array $summaries): bool {
		return ($summaries[$folder->fileId] ?? null)?->etag === $folder->etag;
	}

	/** @throws InvalidLibraryRequestException */
	private static function number(string $value, int $default, string $name): int {
		if ($value === '') {
			return $default;
		}
		if (preg_match(self::NUMBER, $value) !== 1) {
			throw new InvalidLibraryRequestException("$name must be a whole number");
		}
		return (int)$value;
	}
}
