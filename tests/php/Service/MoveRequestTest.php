<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\InvalidMoveRequestException;
use OCA\Honeycomb\Service\ListingService;
use OCA\Honeycomb\Service\MoveRequest;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class MoveRequestTest extends TestCase {
	/** @return array{fileId: int, etag: string, path: string} */
	private static function to(int $fileId, string $path): array {
		return ['fileId' => $fileId, 'etag' => "etag-$fileId", 'path' => $path];
	}

	/** @return array<string, array{array<array-key, mixed>}> */
	public static function malformedRequests(): array {
		$file = self::to(1, '/Out/X.RAF');
		return [
			'no list' => [['a' => [$file]]],
			'a picture that is no list' => [[$file]],
			'an empty picture' => [[[]]],
			'a file that is no object' => [[[1]]],
			'a file id that is no positive integer' => [[[['fileId' => 0] + $file]]],
			'a file id as a string' => [[[['fileId' => '1'] + $file]]],
			'a missing ETag' => [[[['fileId' => 1, 'path' => '/Out/X.RAF']]]],
			'an empty ETag' => [[[['etag' => ''] + $file]]],
			'a missing path' => [[[['fileId' => 1, 'etag' => 'etag-1']]]],
			'a relative path' => [[[['path' => 'Out/X.RAF'] + $file]]],
			'an empty segment' => [[[['path' => '/Out//X.RAF'] + $file]]],
			'a trailing slash' => [[[['path' => '/Out/'] + $file]]],
			'the root' => [[[['path' => '/'] + $file]]],
			'a dot segment' => [[[['path' => '/Out/./X.RAF'] + $file]]],
			'a dot-dot segment' => [[[['path' => '/Out/../../bob/X.RAF'] + $file]]],
			'a backslash' => [[[['path' => '/Out\\X.RAF'] + $file]]],
			'a NUL' => [[[['path' => "/Out/X.RAF\0"] + $file]]],
			'a replace that is no object' => [[[['replace' => 9] + $file]]],
			'a replace without ETag' => [[[['replace' => ['fileId' => 9]] + $file]]],
			'a replace of a file of the request' => [[[$file, self::to(2, '/Out/X.JPG') + ['replace' => ['fileId' => 1, 'etag' => 'etag-1']]]]],
			'a file id in two pictures' => [[[$file], [$file]]],
			'a target path twice, in another case' => [[[$file], [self::to(2, '/out/x.raf')]]],
			'more files than the limit' => [[array_map(static fn (int $id): array => self::to($id, "/Out/$id.JPG"), range(1, ListingService::ENTRY_LIMIT + 1))]],
		];
	}

	// spec: MOVE-002.8
	#[DataProvider('malformedRequests')]
	public function testAMalformedRequestIsRefusedWhole(array $pictures): void {
		$this->expectException(InvalidMoveRequestException::class);

		MoveRequest::pictures($pictures);
	}

	// spec: MOVE-002.8
	public function testTheLimitItselfIsAccepted(): void {
		$request = [array_map(static fn (int $id): array => self::to($id, "/Out/$id.JPG"), range(1, ListingService::ENTRY_LIMIT))];

		$this->assertCount(ListingService::ENTRY_LIMIT, MoveRequest::pictures($request)[0]);
	}
}
