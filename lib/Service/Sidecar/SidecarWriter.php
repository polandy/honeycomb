<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service\Sidecar;

use OCA\Honeycomb\Domain\InvalidRequestException;
use OCA\Honeycomb\Domain\PhotoFiles;
use OCA\Honeycomb\Service\Files\UserPhotos;
use OCA\Honeycomb\Service\Stats\StatsCount;
use OCA\Honeycomb\Service\Stats\StatsService;
use OCP\Files\File;
use OCP\Files\Folder;
use OCP\Files\GenericFileException;
use OCP\Files\InvalidPathException;
use OCP\Files\NotEnoughSpaceException;
use OCP\Files\NotFoundException;
use OCP\Files\NotPermittedException;
use OCP\Files\StorageNotAvailableException;
use OCP\IUser;
use OCP\Lock\LockedException;
use Psr\Log\LoggerInterface;

/** Saves sidecars by the checked save: check, then write in place (ADR 0017); counts the saves (ADR 0039). */
final class SidecarWriter {
	public function __construct(
		private UserPhotos $photos,
		private LoggerInterface $logger,
		private StatsService $stats,
	) {
	}

	/**
	 * Saves each sidecar, counts the saves and reports each, in the order sent.
	 * @param array<array-key, mixed> $sidecars
	 * @return list<array{result: SidecarResult, fileId?: int, etag?: string, size?: int|float, mtime?: int}>
	 * @throws InvalidRequestException for a malformed request; nothing is written
	 */
	public function save(IUser $user, array $sidecars): array {
		$sidecars = SidecarRequest::sidecars($sidecars);
		$userFolder = $this->photos->userFolder($user);
		$written = [];
		$counts = [];
		$results = array_map(function (ExistingSidecar|NewSidecar $sidecar) use ($userFolder, &$written, &$counts): array {
			return $this->saveOne($userFolder, $sidecar, $written, $counts);
		}, $sidecars);
		$this->stats->countSidecars($user, $written, ...$counts);
		return $results;
	}

	/**
	 * @param list<array{mtime: ?int, foreign: bool}> $written gains the modification time a saved sidecar had before, null for a created one, and whether it is foreign
	 * @param list<StatsCount> $counts gains the counts a saved item carried
	 * @return array{result: SidecarResult, fileId?: int, etag?: string, size?: int|float, mtime?: int}
	 */
	private function saveOne(Folder $userFolder, ExistingSidecar|NewSidecar $sidecar, array &$written, array &$counts): array {
		$target = $this->check($userFolder, $sidecar);
		if ($target instanceof SidecarResult) {
			return ['result' => $target];
		}
		[$folder, $name, $existing] = $target;
		if (!$this->fits($folder, $sidecar->bytes, $existing)) {
			return ['result' => SidecarResult::NoSpace];
		}
		$previous = $this->previousMTime($existing);
		try {
			$saved = $existing === null ? $folder->newFile($name, $sidecar->bytes) : $this->replace($existing, $sidecar->bytes);
			$foreign = $sidecar instanceof ExistingSidecar && $sidecar->foreign;
			array_push($written, ...array_map(static fn (?int $mtime): array => ['mtime' => $mtime, 'foreign' => $foreign], $previous));
			array_push($counts, ...$sidecar->counts);
			return ['result' => SidecarResult::Saved, 'fileId' => $saved->getId(), 'etag' => $saved->getEtag(), 'size' => $saved->getSize(), 'mtime' => $saved->getMTime()];
		} catch (GenericFileException|InvalidPathException|StorageNotAvailableException|NotEnoughSpaceException|NotPermittedException|LockedException|NotFoundException $e) {
			return ['result' => $this->resultOf($e, $existing?->getId())];
		}
	}

	/**
	 * The modification time of the sidecar a save replaces, null for a created one, or nothing when it cannot be read, so the save goes on uncounted.
	 * @return list<?int>
	 */
	private function previousMTime(?File $existing): array {
		try {
			return [$existing?->getMTime()];
		} catch (GenericFileException|InvalidPathException|StorageNotAvailableException $e) {
			// Statistics are best effort; the save must not fail for them.
			$this->logger->warning('Could not read the modification time of a sidecar to count it', ['exception' => $e]);
			return [];
		}
	}

	/**
	 * The folder and name to save to with the sidecar it replaces, or why the sidecar may not be saved.
	 * @return array{Folder, string, ?File}|SidecarResult
	 */
	private function check(Folder $userFolder, ExistingSidecar|NewSidecar $sidecar): array|SidecarResult {
		if ($sidecar instanceof NewSidecar) {
			return $this->checkNew($userFolder, $sidecar->path);
		}
		$node = $this->photos->sidecar($userFolder, $sidecar->fileId);
		if ($node === null) {
			return SidecarResult::NotFound;
		}
		if ($node->getEtag() !== $sidecar->etag || $node->getSize() !== $sidecar->size) {
			return SidecarResult::Changed;
		}
		if (!$node->isUpdateable()) {
			return SidecarResult::NotPermitted;
		}
		return [$node->getParent(), $node->getName(), $node];
	}

	/** @return array{Folder, string, null}|SidecarResult */
	private function checkNew(Folder $userFolder, string $path): array|SidecarResult {
		try {
			$image = $userFolder->get(substr($path, 0, -strlen('.xmp')));
		} catch (NotFoundException) {
			return SidecarResult::NotFound;
		}
		if (!$image instanceof File || !PhotoFiles::isListedType($image) || PhotoFiles::isSidecar($image)) {
			return SidecarResult::NotFound;
		}
		$folder = $image->getParent();
		$name = basename($path);
		if ($folder->nodeExists($name)) {
			return SidecarResult::Changed;
		}
		return $folder->isCreatable() ? [$folder, $name, null] : SidecarResult::NotPermitted;
	}

	/** Whether the bytes fit the folder's free space, less the sidecar they replace; an unknown or unlimited space fits (XMP-002.12). */
	private function fits(Folder $folder, string $bytes, ?File $existing): bool {
		$free = $folder->getFreeSpace();
		return $free < 0 || strlen($bytes) - (int)($existing?->getSize() ?? 0) <= $free;
	}

	/** Writes in place, so the sidecar keeps its file id and its replaced bytes become a version (XMP-002.11). */
	private function replace(File $sidecar, string $bytes): File {
		$sidecar->putContent($bytes);
		return $sidecar;
	}

	private function resultOf(\Exception $e, ?int $fileId): SidecarResult {
		return match (true) {
			$e instanceof NotEnoughSpaceException => SidecarResult::NoSpace,
			$e instanceof NotPermittedException => SidecarResult::NotPermitted,
			$e instanceof LockedException => SidecarResult::Locked,
			$e instanceof NotFoundException => SidecarResult::NotFound,
			default => $this->failed($e, $fileId),
		};
	}

	private function failed(\Exception $e, ?int $fileId): SidecarResult {
		$this->logger->warning('A sidecar could not be saved', ['fileId' => $fileId, 'exception' => $e]);
		return SidecarResult::Failed;
	}
}
