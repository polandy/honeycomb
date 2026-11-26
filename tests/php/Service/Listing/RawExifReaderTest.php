<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service\Listing;

use DateTimeZone;
use OCA\Honeycomb\Service\Listing\RawExifReader;
use OCA\Honeycomb\Service\Listing\RawHeaderParser;
use OCA\Honeycomb\Service\Listing\TiffFields;
use OCA\Honeycomb\Tests\Service\MemoryStream;
use OCP\Files\File;
use OCP\Files\NotPermittedException;
use OCP\Lock\LockedException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

final class RawExifReaderTest extends TestCase {
	/** @var list<string> the warnings logged */
	private array $warnings = [];

	private function reader(): RawExifReader {
		$logger = $this->createStub(LoggerInterface::class);
		$logger->method('warning')->willReturnCallback(function (string $message): void {
			$this->warnings[] = $message;
		});
		return new RawExifReader(new RawHeaderParser(new TiffFields()), $logger);
	}

	/** A file whose stream holds `$bytes`, or whose `fopen` gives `$open` instead. */
	private function file(string $bytes, \Throwable|false|null $open = null): File {
		$file = $this->createStub(File::class);
		$file->method('getId')->willReturn(7);
		if ($open instanceof \Throwable) {
			$file->method('fopen')->willThrowException($open);
			return $file;
		}
		$file->method('fopen')->willReturn($open ?? MemoryStream::of($bytes));
		return $file;
	}

	// spec: LISTING-004.1, LISTING-004.4
	public function testReadsTheValueFromTheFilesStream(): void {
		$tiff = RawBytes::tiff(['Make' => 'Canon', 'Model' => 'EOS R5'], ['DateTimeOriginal' => '2026:11:25 14:03:09']);

		$value = $this->reader()->read($this->file($tiff . str_repeat("\0", 2 * RawExifReader::READ_LIMIT)), new DateTimeZone('UTC'));

		$this->assertSame(['DateTimeOriginal' => 1_795_615_389, 'Make' => 'Canon', 'Model' => 'EOS R5'], $value);
	}

	// spec: LISTING-004.7
	public function testCountsAValueBeyondTheFirstMibAsAbsent(): void {
		$make = RawBytes::tiff(['Make' => 'NIKON CORPORATION']);
		$within = RawExifReader::READ_LIMIT - 18;
		$beyond = RawExifReader::READ_LIMIT - 17;
		$file = static fn (int $at): string => str_pad(substr($make, 0, 18) . pack('V', $at) . substr($make, 22), $at, "\0") . "NIKON CORPORATION\0";

		$this->assertSame(['Make' => 'NIKON CORPORATION'], $this->reader()->read($this->file($file($within)), new DateTimeZone('UTC')));
		$this->assertSame([], $this->reader()->read($this->file($file($beyond)), new DateTimeZone('UTC')));
	}

	/** @return array<string, array{\Throwable|false}> */
	public static function failedOpens(): array {
		return ['not permitted' => [new NotPermittedException('no')], 'locked' => [new LockedException('/alice/files/a.nef')], 'no stream' => [false]];
	}

	// spec: LISTING-004.10
	#[DataProvider('failedOpens')]
	public function testLogsAFileThatCannotBeOpened(\Throwable|false $open): void {
		$this->assertNull($this->reader()->read($this->file('', $open), new DateTimeZone('UTC')));
		$this->assertSame(['Could not open the RAW file {fileId} to read its header'], $this->warnings);
	}
}
