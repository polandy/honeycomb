<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCP\Files\File;
use OCP\Files\Folder;
use OCP\Files\IRootFolder;
use OCP\Files\NotFoundException;
use OCP\Files\NotPermittedException;
use OCP\IUser;
use OCP\Lock\LockedException;
use Psr\Log\LoggerInterface;

/** Saves sidecars by the checked save: check, write a part file, check again, rename (ADR 0017). */
final class SidecarWriter {
	public function __construct(
		private IRootFolder $rootFolder,
		private LoggerInterface $logger,
	) {
	}

	/**
	 * Saves each sidecar and reports each, in the order sent.
	 * @param array<array-key, mixed> $sidecars
	 * @return list<array{result: SidecarResult, fileId?: int, etag?: string, size?: int|float, mtime?: int}>
	 * @throws InvalidSidecarRequestException for a malformed request; nothing is written
	 */
	public function save(IUser $user, array $sidecars): array {
		$sidecars = SidecarRequest::sidecars($sidecars);
		$userFolder = $this->rootFolder->getUserFolder($user->getUID());
		return array_map(fn (ExistingSidecar|NewSidecar $sidecar): array => $this->saveOne($userFolder, $sidecar), $sidecars);
	}

	/** @return array{result: SidecarResult, fileId?: int, etag?: string, size?: int|float, mtime?: int} */
	private function saveOne(Folder $userFolder, ExistingSidecar|NewSidecar $sidecar): array {
		$target = $this->check($userFolder, $sidecar);
		if ($target instanceof SidecarResult) {
			return ['result' => $target];
		}
		[$folder, $name] = $target;
		$part = null;
		try {
			$part = $folder->newFile("$name.part", $sidecar->bytes);
			$again = $this->check($userFolder, $sidecar);
			if ($again instanceof SidecarResult) {
				$this->deletePart($part);
				return ['result' => $again];
			}
			$saved = $part->move($folder->getPath() . "/$name");
			return ['result' => SidecarResult::Saved, 'fileId' => $saved->getId(), 'etag' => $saved->getEtag(), 'size' => $saved->getSize(), 'mtime' => $saved->getMTime()];
		} catch (\Exception $e) {
			if ($part !== null) {
				$this->deletePart($part);
			}
			return ['result' => $this->resultOf($e, $folder->getPath() . "/$name")];
		}
	}

	/**
	 * The folder and name to save to, or why the sidecar may not be saved.
	 * @return array{Folder, string}|SidecarResult
	 */
	private function check(Folder $userFolder, ExistingSidecar|NewSidecar $sidecar): array|SidecarResult {
		if ($sidecar instanceof NewSidecar) {
			return $this->checkNew($userFolder, $sidecar->path);
		}
		$node = $userFolder->getFirstNodeById($sidecar->fileId);
		if (!$node instanceof File || !ListingService::isSidecar($node)) {
			return SidecarResult::NotFound;
		}
		if ($node->getEtag() !== $sidecar->etag || $node->getSize() !== $sidecar->size) {
			return SidecarResult::Changed;
		}
		$folder = $node->getParent();
		if (!$node->isUpdateable() || !$folder->isCreatable()) {
			return SidecarResult::NotPermitted;
		}
		return [$folder, $node->getName()];
	}

	/** @return array{Folder, string}|SidecarResult */
	private function checkNew(Folder $userFolder, string $path): array|SidecarResult {
		try {
			$image = $userFolder->get(substr($path, 0, -strlen('.xmp')));
		} catch (NotFoundException) {
			return SidecarResult::NotFound;
		}
		if (!$image instanceof File || !ListingService::isListedType($image) || ListingService::isSidecar($image)) {
			return SidecarResult::NotFound;
		}
		$folder = $image->getParent();
		$name = basename($path);
		if ($folder->nodeExists($name)) {
			return SidecarResult::Changed;
		}
		return $folder->isCreatable() ? [$folder, $name] : SidecarResult::NotPermitted;
	}

	private function deletePart(File $part): void {
		try {
			$part->delete();
		} catch (\Exception $e) {
			$this->logger->warning('A sidecar part file could not be deleted', ['path' => $part->getPath(), 'exception' => $e]);
		}
	}

	private function resultOf(\Exception $e, string $path): SidecarResult {
		return match (true) {
			$e instanceof NotPermittedException => SidecarResult::NotPermitted,
			$e instanceof LockedException => SidecarResult::Locked,
			$e instanceof NotFoundException => SidecarResult::NotFound,
			default => $this->failed($e, $path),
		};
	}

	private function failed(\Exception $e, string $path): SidecarResult {
		$this->logger->warning('A sidecar could not be saved', ['path' => $path, 'exception' => $e]);
		return SidecarResult::Failed;
	}
}
