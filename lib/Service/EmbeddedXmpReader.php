<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCP\Files\File;
use OCP\Files\Folder;
use OCP\Files\IRootFolder;
use OCP\IUser;
use Psr\Log\LoggerInterface;

/** Hands the client the XMP packet each listed JPEG embeds (ADR 0023). */
final class EmbeddedXmpReader {
	private const string JPEG_MIME = 'image/jpeg';

	public function __construct(
		private IRootFolder $rootFolder,
		private JpegXmp $jpegXmp,
		private LoggerInterface $logger,
	) {
	}

	/**
	 * Reads each JPEG's packet and reports each, in the order sent.
	 * @param array<array-key, mixed> $fileIds
	 * @return list<array{fileId: int, result: SidecarResult, content?: string}>
	 * @throws InvalidSidecarRequestException for a malformed request; nothing is read
	 */
	public function lookup(IUser $user, array $fileIds): array {
		$fileIds = SidecarRequest::fileIds($fileIds);
		$userFolder = $this->rootFolder->getUserFolder($user->getUID());
		return array_map(fn (int $fileId): array => ['fileId' => $fileId, ...$this->read($userFolder, $fileId)], $fileIds);
	}

	/** @return array{result: SidecarResult, content?: string} */
	private function read(Folder $userFolder, int $fileId): array {
		$node = $userFolder->getFirstNodeById($fileId);
		if (!$node instanceof File || $node->getMimetype() !== self::JPEG_MIME) {
			return ['result' => SidecarResult::NotFound];
		}
		if (!$node->isReadable()) {
			return ['result' => SidecarResult::NotPermitted];
		}
		try {
			$packet = $this->packetOf($node);
		} catch (\Exception $e) {
			$result = SidecarResult::ofFailure($e);
			if ($result === SidecarResult::Failed) {
				$this->logger->warning('The embedded XMP of a JPEG could not be read', ['fileId' => $fileId, 'exception' => $e]);
			}
			return ['result' => $result];
		}
		return $packet === null ? ['result' => SidecarResult::NoPacket] : ['result' => SidecarResult::Read, 'content' => base64_encode($packet)];
	}

	/** @throws \Exception when the JPEG cannot be opened */
	private function packetOf(File $jpeg): ?string {
		$stream = $jpeg->fopen('r');
		if ($stream === false) {
			throw new \RuntimeException('The JPEG could not be opened');
		}
		try {
			return $this->jpegXmp->packet($stream);
		} finally {
			fclose($stream);
		}
	}
}
