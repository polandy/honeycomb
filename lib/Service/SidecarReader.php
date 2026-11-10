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

/** Hands the client the bytes of listed sidecars (ADR 0017). */
final class SidecarReader {
	public function __construct(
		private IRootFolder $rootFolder,
		private LoggerInterface $logger,
	) {
	}

	/**
	 * Reads each sidecar and reports each, in the order sent.
	 * @param array<array-key, mixed> $fileIds
	 * @return list<array{fileId: int, result: SidecarResult, content?: string, etag?: string, size?: int|float, mtime?: int}>
	 * @throws InvalidSidecarRequestException for a malformed request; nothing is read
	 */
	public function lookup(IUser $user, array $fileIds): array {
		$fileIds = SidecarRequest::fileIds($fileIds);
		$userFolder = $this->rootFolder->getUserFolder($user->getUID());
		return array_map(fn (int $fileId): array => ['fileId' => $fileId, ...$this->read($userFolder, $fileId)], $fileIds);
	}

	/** @return array{result: SidecarResult, content?: string, etag?: string, size?: int|float, mtime?: int} */
	private function read(Folder $userFolder, int $fileId): array {
		$node = $userFolder->getFirstNodeById($fileId);
		if (!$node instanceof File || !ListingService::isSidecar($node)) {
			return ['result' => SidecarResult::NotFound];
		}
		if (!$node->isReadable()) {
			return ['result' => SidecarResult::NotPermitted];
		}
		if ($node->getSize() > SidecarLimits::MAX_BYTES) {
			return ['result' => SidecarResult::TooLarge];
		}
		try {
			[$etag, $size, $mtime] = [$node->getEtag(), $node->getSize(), $node->getMTime()];
			$bytes = $node->getContent();
		} catch (\Exception $e) {
			return ['result' => $this->resultOf($e, $fileId)];
		}
		if (strlen($bytes) > SidecarLimits::MAX_BYTES) {
			return ['result' => SidecarResult::TooLarge];
		}
		return ['result' => SidecarResult::Read, 'content' => base64_encode($bytes), 'etag' => $etag, 'size' => $size, 'mtime' => $mtime];
	}

	private function resultOf(\Exception $e, int $fileId): SidecarResult {
		return match (true) {
			$e instanceof NotPermittedException => SidecarResult::NotPermitted,
			$e instanceof LockedException => SidecarResult::Locked,
			$e instanceof NotFoundException => SidecarResult::NotFound,
			default => $this->failed($e, $fileId),
		};
	}

	private function failed(\Exception $e, int $fileId): SidecarResult {
		$this->logger->warning('A sidecar could not be read', ['fileId' => $fileId, 'exception' => $e]);
		return SidecarResult::Failed;
	}
}
