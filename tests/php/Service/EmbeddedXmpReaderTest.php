<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\EmbeddedXmpReader;
use OCA\Honeycomb\Service\InvalidSidecarRequestException;
use OCA\Honeycomb\Service\JpegXmp;
use OCA\Honeycomb\Service\SidecarLimits;
use OCA\Honeycomb\Service\SidecarResult;
use OCP\Files\File;
use OCP\Files\Folder;
use OCP\Files\IRootFolder;
use OCP\Files\Node;
use OCP\Files\NotFoundException;
use OCP\Files\NotPermittedException;
use OCP\IUser;
use OCP\Lock\LockedException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

final class EmbeddedXmpReaderTest extends TestCase {
	private const string XMP_HEADER = "http://ns.adobe.com/xap/1.0/\x00";

	private function user(): IUser {
		$user = $this->createStub(IUser::class);
		$user->method('getUID')->willReturn('alice');
		return $user;
	}

	/** A JPEG whose stream holds `$bytes`, or whose opening throws `$failure`. */
	private function jpeg(string $bytes = "\xFF\xD8\xFF\xD9", string $mime = 'image/jpeg', bool $readable = true, ?\Throwable $failure = null, bool $opens = true): File {
		$file = $this->createStub(File::class);
		$file->method('getName')->willReturn('IMG_0001.JPG');
		$file->method('getMimetype')->willReturn($mime);
		$file->method('isReadable')->willReturn($readable);
		$file->method('fopen')->willReturnCallback(static function () use ($bytes, $failure, $opens) {
			if ($failure !== null) {
				throw $failure;
			}
			if (!$opens) {
				return false;
			}
			return MemoryStream::of($bytes);
		});
		return $file;
	}

	private static function withPacket(string $packet): string {
		return "\xFF\xD8\xFF\xE1" . pack('n', strlen(self::XMP_HEADER . $packet) + 2) . self::XMP_HEADER . $packet . "\xFF\xD9";
	}

	/** @param array<int, Node> $nodes alice's nodes by file id */
	private function reader(array $nodes, ?LoggerInterface $logger = null): EmbeddedXmpReader {
		$userFolder = $this->createStub(Folder::class);
		$userFolder->method('getFirstNodeById')->willReturnCallback(static fn (int $id): ?Node => $nodes[$id] ?? null);
		$root = $this->createStub(IRootFolder::class);
		$root->method('getUserFolder')->willReturnMap([['alice', $userFolder]]);
		return new EmbeddedXmpReader($root, new JpegXmp(), $logger ?? $this->createStub(LoggerInterface::class));
	}

	// spec: XMP-005.1, XMP-005.2
	public function testAnswersThePacketOfEachJpegInTheOrderSent(): void {
		$reader = $this->reader([
			7 => $this->jpeg(self::withPacket("<x:xmpmeta>\xff</x:xmpmeta>")),
			3 => $this->jpeg(self::withPacket('<x:xmpmeta/>')),
			5 => $this->jpeg(),
		]);

		$this->assertSame([
			['fileId' => 7, 'result' => SidecarResult::Read, 'content' => base64_encode("<x:xmpmeta>\xff</x:xmpmeta>")],
			['fileId' => 3, 'result' => SidecarResult::Read, 'content' => base64_encode('<x:xmpmeta/>')],
			['fileId' => 5, 'result' => SidecarResult::NoPacket],
		], $reader->lookup($this->user(), [7, 3, 5]));
	}

	// spec: XMP-005.3
	public function testReportsWhatItCannotRead(): void {
		$sidecar = $this->createStub(File::class);
		$sidecar->method('getName')->willReturn('IMG_0001.JPG.xmp');
		$sidecar->method('getMimetype')->willReturn('application/octet-stream');
		$logger = $this->createMock(LoggerInterface::class);
		$logger->expects($this->once())->method('warning')->with($this->anything(), $this->callback(
			static fn (array $context): bool => $context['fileId'] === 6 && $context['exception'] instanceof \RuntimeException,
		));
		$reader = $this->reader([
			2 => $sidecar,
			3 => $this->createStub(Folder::class),
			4 => $this->jpeg(mime: 'image/png'),
			5 => $this->jpeg(readable: false),
			6 => $this->jpeg(failure: new \RuntimeException('disk')),
			7 => $this->jpeg(failure: new LockedException('IMG_0007.JPG')),
		], $logger);

		$this->assertSame(
			[['fileId' => 1, 'result' => SidecarResult::NotFound], ['fileId' => 2, 'result' => SidecarResult::NotFound], ['fileId' => 3, 'result' => SidecarResult::NotFound],
				['fileId' => 4, 'result' => SidecarResult::NotFound], ['fileId' => 5, 'result' => SidecarResult::NotPermitted],
				['fileId' => 6, 'result' => SidecarResult::Failed], ['fileId' => 7, 'result' => SidecarResult::Locked]],
			$reader->lookup($this->user(), [1, 2, 3, 4, 5, 6, 7]),
		);
	}

	/** @return array<string, array{\Exception, SidecarResult}> */
	public static function openFailures(): array {
		return [
			'not permitted' => [new NotPermittedException('IMG_0001.JPG'), SidecarResult::NotPermitted],
			'vanished' => [new NotFoundException('IMG_0001.JPG'), SidecarResult::NotFound],
			'locked' => [new LockedException('IMG_0001.JPG'), SidecarResult::Locked],
		];
	}

	// spec: XMP-005.3
	#[DataProvider('openFailures')]
	public function testAFailureWhileOpeningIsReportedWithoutBytes(\Exception $failure, SidecarResult $expected): void {
		$this->assertSame([['fileId' => 9, 'result' => $expected]], $this->reader([9 => $this->jpeg(failure: $failure)])->lookup($this->user(), [9]));
	}

	// spec: XMP-005.3
	public function testAStreamThatDoesNotOpenFailsAndIsLogged(): void {
		$logger = $this->createMock(LoggerInterface::class);
		$logger->expects($this->once())->method('warning');

		$this->assertSame([['fileId' => 9, 'result' => SidecarResult::Failed]], $this->reader([9 => $this->jpeg(opens: false)], $logger)->lookup($this->user(), [9]));
	}

	/** @return array<string, array{list<mixed>}> */
	public static function malformed(): array {
		return [
			'not an integer' => [['9']],
			'not positive' => [[0]],
			'twice' => [[9, 9]],
			'too many' => [range(1, SidecarLimits::MAX_ITEMS + 1)],
		];
	}

	// spec: XMP-005.4
	#[DataProvider('malformed')]
	public function testAMalformedLookupOpensNothing(array $fileIds): void {
		$userFolder = $this->createMock(Folder::class);
		$userFolder->expects($this->never())->method('getFirstNodeById');
		$root = $this->createStub(IRootFolder::class);
		$root->method('getUserFolder')->willReturn($userFolder);

		$this->expectException(InvalidSidecarRequestException::class);
		(new EmbeddedXmpReader($root, new JpegXmp(), $this->createStub(LoggerInterface::class)))->lookup($this->user(), $fileIds);
	}
}
