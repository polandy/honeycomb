<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\InvalidSidecarRequestException;
use OCA\Honeycomb\Service\SidecarLimits;
use OCA\Honeycomb\Service\SidecarReader;
use OCA\Honeycomb\Service\SidecarResult;
use OCP\Files\File;
use OCP\Files\Folder;
use OCP\Files\IRootFolder;
use OCP\Files\Node;
use OCP\IUser;
use OCP\Lock\LockedException;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

final class SidecarReaderTest extends TestCase {
	private function user(): IUser {
		$user = $this->createStub(IUser::class);
		$user->method('getUID')->willReturn('alice');
		return $user;
	}

	private function sidecar(int $id, string $name = 'IMG_0001.NEF.xmp', string $content = '<x:xmpmeta/>', ?int $size = null, bool $readable = true, ?\Throwable $failure = null): File {
		$file = $this->createStub(File::class);
		$file->method('getId')->willReturn($id);
		$file->method('getName')->willReturn($name);
		$file->method('getMimetype')->willReturn('application/octet-stream');
		$file->method('getEtag')->willReturn("etag-$id");
		$file->method('getSize')->willReturn($size ?? strlen($content));
		$file->method('getMTime')->willReturn(1_700_000_000 + $id);
		$file->method('isReadable')->willReturn($readable);
		$file->method('getContent')->willReturnCallback(static function () use ($content, $failure): string {
			if ($failure !== null) {
				throw $failure;
			}
			return $content;
		});
		return $file;
	}

	/** @param array<int, Node> $nodes alice's nodes by file id */
	private function reader(array $nodes, ?LoggerInterface $logger = null): SidecarReader {
		$userFolder = $this->createStub(Folder::class);
		$userFolder->method('getFirstNodeById')->willReturnCallback(static fn (int $id): ?Node => $nodes[$id] ?? null);
		$root = $this->createStub(IRootFolder::class);
		$root->method('getUserFolder')->willReturnMap([['alice', $userFolder]]);
		return new SidecarReader($root, $logger ?? $this->createStub(LoggerInterface::class));
	}

	// spec: XMP-002.1
	public function testAnswersTheBytesOfEachSidecarInTheOrderSent(): void {
		$reader = $this->reader([
			9 => $this->sidecar(9, 'IMG_0001.NEF.xmp', "<x:xmpmeta>\xff</x:xmpmeta>"),
			4 => $this->sidecar(4, 'IMG_0002.XMP', '<x:xmpmeta/>'),
		]);

		$this->assertSame([
			['fileId' => 4, 'result' => SidecarResult::Read, 'content' => base64_encode('<x:xmpmeta/>'), 'etag' => 'etag-4', 'size' => 12, 'mtime' => 1_700_000_004],
			['fileId' => 9, 'result' => SidecarResult::Read, 'content' => base64_encode("<x:xmpmeta>\xff</x:xmpmeta>"), 'etag' => 'etag-9', 'size' => 24, 'mtime' => 1_700_000_009],
		], $reader->lookup($this->user(), [4, 9]));
	}

	// spec: XMP-002.2
	public function testReportsWhatItCannotRead(): void {
		$image = $this->createStub(File::class);
		$image->method('getName')->willReturn('IMG_0001.JPG');
		$logger = $this->createMock(LoggerInterface::class);
		$logger->expects($this->once())->method('warning')->with($this->anything(), $this->callback(
			static fn (array $context): bool => $context['fileId'] === 6 && $context['exception'] instanceof \RuntimeException,
		));
		$reader = $this->reader([
			2 => $image,
			3 => $this->createStub(Folder::class),
			4 => $this->sidecar(4, size: SidecarLimits::MAX_BYTES + 1),
			5 => $this->sidecar(5, readable: false),
			6 => $this->sidecar(6, failure: new \RuntimeException('disk')),
			7 => $this->sidecar(7, failure: new LockedException('IMG_0007.xmp')),
			8 => $this->sidecar(8),
		], $logger);

		$results = $reader->lookup($this->user(), [1, 2, 3, 4, 5, 6, 7, 8]);

		$this->assertSame(
			[[1, SidecarResult::NotFound], [2, SidecarResult::NotFound], [3, SidecarResult::NotFound], [4, SidecarResult::TooLarge],
				[5, SidecarResult::NotPermitted], [6, SidecarResult::Failed], [7, SidecarResult::Locked], [8, SidecarResult::Read]],
			array_map(static fn (array $result): array => [$result['fileId'], $result['result']], $results),
		);
		$this->assertSame([['fileId', 'result']], array_unique(array_map(array_keys(...), array_slice($results, 0, 7)), SORT_REGULAR));
	}

	// spec: XMP-002.2
	public function testContentThatGrewOverTheLimitWhileReadingIsTooLarge(): void {
		$reader = $this->reader([4 => $this->sidecar(4, content: str_repeat('x', SidecarLimits::MAX_BYTES + 1), size: 10)]);

		$this->assertSame([['fileId' => 4, 'result' => SidecarResult::TooLarge]], $reader->lookup($this->user(), [4]));
	}

	// spec: XMP-002.7
	public function testAMalformedLookupReadsNothing(): void {
		$userFolder = $this->createMock(Folder::class);
		$userFolder->expects($this->never())->method('getFirstNodeById');
		$root = $this->createStub(IRootFolder::class);
		$root->method('getUserFolder')->willReturn($userFolder);

		$this->expectException(InvalidSidecarRequestException::class);
		(new SidecarReader($root, $this->createStub(LoggerInterface::class)))->lookup($this->user(), [9, 9]);
	}
}
