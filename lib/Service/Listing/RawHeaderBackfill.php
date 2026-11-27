<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service\Listing;

use OCA\Honeycomb\BackgroundJob\ReadRawHeaders;
use OCA\Honeycomb\Domain\PairingExtensions;
use OCA\Honeycomb\Service\Settings\SettingsService;
use OCP\BackgroundJob\IJobList;
use OCP\Files\File;
use OCP\FilesMetadata\IFilesMetadataManager;
use OCP\IUser;

/** Queues `ReadRawHeaders` for a user's RAW files that have no header key yet (LISTING-004.14, ADR 0061). */
final class RawHeaderBackfill {
	/** File ids per job. */
	public const int JOB_FILES = 500;
	/** File ids per metadata request. */
	private const int BATCH = 1_000;

	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it. */
	public function __construct(
		private IFilesMetadataManager $metadataManager,
		private IJobList $jobs,
		private SettingsService $settings,
	) {
	}

	/**
	 * Queues the RAW files among `$files` that belong to `$user` and have no key.
	 * @param list<File> $files
	 */
	public function queueFiles(IUser $user, array $files): void {
		$extensions = $this->settings->pairing($user->getUID());
		$ids = [];
		foreach ($files as $file) {
			if (self::isRaw($extensions, $file->getName()) && $file->getOwner()?->getUID() === $user->getUID()) {
				$ids[] = $file->getId();
			}
		}
		$this->queueUnread($user->getUID(), $ids);
	}

	/**
	 * Queues the RAW files among `$files` of the user's own storage that have no key.
	 * @param list<array{fileId: int, name: string, ...}> $files
	 */
	public function queueRows(IUser $user, array $files): void {
		$extensions = $this->settings->pairing($user->getUID());
		$raws = array_filter($files, static fn (array $file): bool => self::isRaw($extensions, $file['name']));
		$this->queueUnread($user->getUID(), array_values(array_map(static fn (array $file): int => $file['fileId'], $raws)));
	}

	/** @param list<int> $fileIds */
	private function queueUnread(string $userId, array $fileIds): void {
		$unread = [];
		foreach (array_chunk($fileIds, self::BATCH) as $chunk) {
			$metadata = $this->metadataManager->getMetadataForFiles($chunk);
			foreach ($chunk as $fileId) {
				if (!(isset($metadata[$fileId]) && $metadata[$fileId]->hasKey(RawExif::KEY))) {
					$unread[] = $fileId;
				}
			}
		}
		sort($unread);
		foreach (array_chunk($unread, self::JOB_FILES) as $chunk) {
			$argument = ['userId' => $userId, 'fileIds' => $chunk];
			if (!$this->jobs->has(ReadRawHeaders::class, $argument)) {
				$this->jobs->add(ReadRawHeaders::class, $argument);
			}
		}
	}

	private static function isRaw(PairingExtensions $extensions, string $name): bool {
		return $extensions->roleOf(pathinfo($name, PATHINFO_EXTENSION)) === 'raw';
	}
}
