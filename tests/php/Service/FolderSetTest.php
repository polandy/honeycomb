<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\FolderSet;
use OCA\Honeycomb\Service\InvalidPositionException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class FolderSetTest extends TestCase {
	// spec: DECISIONS-002.16
	public function testTheKeyNamesTheExcludedFoldersAfterThePathsAsTheClientDoes(): void {
		$set = new FolderSet(['/Trip', '/Trip/Raw/Best'], true, ['/Trip/Raw', '/Trip/Day 2', '/Trip/Raw']);

		$this->assertSame(hash('sha256', '[["/Trip","/Trip/Raw/Best"],true,["/Trip/Day 2","/Trip/Raw"]]'), $set->key());
	}

	/** @return array<string, array{FolderSet, FolderSet}> */
	public static function ineffectiveExclusions(): array {
		return [
			'without subfolders' => [new FolderSet(['/Trip'], false, ['/Trip/Raw']), new FolderSet(['/Trip'], false)],
			'with no ticked folder above' => [new FolderSet(['/Trip'], true, ['/Other/Raw', '/Trips/Raw']), new FolderSet(['/Trip'], true)],
			'inside an excluded one' => [new FolderSet(['/Trip'], true, ['/Trip/Raw', '/Trip/Raw/Old']), new FolderSet(['/Trip'], true, ['/Trip/Raw'])],
			'ticked itself' => [new FolderSet(['/Trip', '/Trip/Raw'], true, ['/Trip/Raw']), new FolderSet(['/Trip'], true)],
		];
	}

	// spec: DECISIONS-002.16
	#[DataProvider('ineffectiveExclusions')]
	public function testTheKeyLeavesOutExclusionsThatLeaveNothingOut(FolderSet $set, FolderSet $same): void {
		$this->assertSame($same->key(), $set->key());
	}

	// spec: DECISIONS-002.16
	public function testAFolderSetStoredBeforeExclusionsKeepsItsKeyAndShape(): void {
		$stored = '{"paths":["/Trip"],"subfolders":true}';

		/** @var array<array-key, mixed> $request */
		$request = json_decode($stored, true, flags: JSON_THROW_ON_ERROR);
		$set = FolderSet::fromRequest($request);

		$this->assertSame([], $set->excluded);
		$this->assertSame(hash('sha256', '[["/Trip"],true]'), $set->key());
		$this->assertSame($stored, json_encode($set, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES));
	}

	// spec: DECISIONS-002.16
	public function testStoresTheExcludedFoldersSortedAndEachOnce(): void {
		$set = FolderSet::fromRequest(['paths' => ['/Trip'], 'subfolders' => true, 'excluded' => ['/Trip/Raw', '/Trip/Day 2', '/Trip/Raw']]);

		$this->assertSame(['paths' => ['/Trip'], 'subfolders' => true, 'excluded' => ['/Trip/Day 2', '/Trip/Raw']], $set->jsonSerialize());
	}

	/** @return array<string, array{mixed}> */
	public static function malformedExclusions(): array {
		return [
			'a string' => ['/Trip/Raw'],
			'a number' => [[7]],
			'a parent step' => [['/Trip/../Other']],
			'too many' => [array_fill(0, FolderSet::MAX_FOLDERS + 1, '/Trip/Raw')],
		];
	}

	// spec: DECISIONS-002.16
	#[DataProvider('malformedExclusions')]
	public function testRejectsMalformedExclusions(mixed $excluded): void {
		$this->expectException(InvalidPositionException::class);

		FolderSet::fromRequest(['paths' => ['/Trip'], 'subfolders' => true, 'excluded' => $excluded]);
	}

	/** @return array<string, array{mixed, ?list<string>}> */
	public static function folderPathLists(): array {
		return [
			'none' => [[], []],
			'paths' => [['/A', '/B'], ['/A', '/B']],
			'a string' => ['/A', null],
			'a map' => [['a' => '/A'], null],
			'a NUL byte' => [["/A\0"], null],
		];
	}

	// spec: LISTING-001.16
	/** @param ?list<string> $expected */
	#[DataProvider('folderPathLists')]
	public function testReadsAListOfFolderPaths(mixed $value, ?array $expected): void {
		$this->assertSame($expected, FolderSet::folderPaths($value));
	}
}
