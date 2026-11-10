<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\Listing;
use OCP\Files\File;
use OCP\Files\Folder;
use OCP\Files\IRootFolder;
use OCP\Files\Search\ISearchBinaryOperator;
use OCP\Files\Search\ISearchComparison;
use OCP\Files\Search\ISearchOperator;
use OCP\Files\Search\ISearchOrder;
use OCP\Files\Search\ISearchQuery;
use OCP\FilesMetadata\Exceptions\FilesMetadataNotFoundException;
use OCP\FilesMetadata\Model\IFilesMetadata;
use OCP\IUser;
use PHPUnit\Framework\MockObject\Stub;

/** Stubs of `OCP\Files` for the user `alice`, whose files live under `/alice/files`. */
trait FakeFiles {
	private const string USER_ROOT = '/alice/files';
	/** The comparisons Nextcloud 35's `SearchBuilder::validateComparison()` accepts for our fields. */
	private const array CACHE_COMPARISONS = [
		'mimetype' => ['eq', 'like', 'in'],
		'name' => ['eq', 'like', 'clike', 'in'],
		'fileid' => ['eq', 'in'],
	];

	/** @return list<array<string, mixed>> */
	private function entriesOf(Listing $listing): array {
		return json_decode(json_encode($listing->jsonSerialize()['entries'], JSON_THROW_ON_ERROR), true, flags: JSON_THROW_ON_ERROR);
	}

	private function user(): IUser {
		$user = $this->createStub(IUser::class);
		$user->method('getUID')->willReturn('alice');
		return $user;
	}

	private function file(int $id, string $path, string $mime = 'image/jpeg'): File&Stub {
		$file = $this->createStub(File::class);
		$file->method('getId')->willReturn($id);
		$file->method('getPath')->willReturn(self::USER_ROOT . $path);
		$file->method('getName')->willReturn(basename($path));
		$file->method('getSize')->willReturn(1000 + $id);
		$file->method('getMTime')->willReturn(1_700_000_000 + $id);
		$file->method('getEtag')->willReturn("etag-$id");
		$file->method('getMimetype')->willReturn($mime);
		return $file;
	}

	/** A folder at `$path` below the user's files. */
	private function folder(string $path, bool $readable = true): Folder&Stub {
		$folder = $this->createStub(Folder::class);
		$absolute = rtrim(self::USER_ROOT . $path, '/');
		$folder->method('getPath')->willReturn($absolute);
		$folder->method('getName')->willReturn(basename($absolute));
		$folder->method('isReadable')->willReturn($readable);
		$folder->method('getRelativePath')->willReturnCallback(
			static fn (string $node): ?string => match (true) {
				$node === $absolute => '/',
				str_starts_with($node, $absolute . '/') => substr($node, strlen($absolute)),
				default => null,
			},
		);
		return $folder;
	}

	/**
	 * A root folder whose user folder resolves `$nodes` by their path below the user's files.
	 * @param array<string, \OCP\Files\Node|\Throwable> $nodes
	 */
	private function rootWith(array $nodes): IRootFolder {
		$userFolder = $this->folder('');
		$userFolder->method('get')->willReturnCallback(
			static function (string $path) use ($nodes): \OCP\Files\Node {
				$key = '/' . trim($path, '/');
				if (!isset($nodes[$key])) {
					throw new \OCP\Files\NotFoundException($path);
				}
				if ($nodes[$key] instanceof \Throwable) {
					throw $nodes[$key];
				}
				return $nodes[$key];
			},
		);
		$root = $this->createStub(IRootFolder::class);
		$root->method('getUserFolder')->willReturnMap([['alice', $userFolder]]);
		return $root;
	}

	/** Metadata as Nextcloud's Photos app stores it, missing keys throw like the real one. */
	private function metadata(array $values): IFilesMetadata {
		$metadata = $this->createStub(IFilesMetadata::class);
		$lookup = static function (string $key) use ($values): mixed {
			if (!array_key_exists($key, $values)) {
				throw new FilesMetadataNotFoundException($key);
			}
			return $values[$key];
		};
		$metadata->method('hasKey')->willReturnCallback(static fn (string $key): bool => array_key_exists($key, $values));
		$metadata->method('getInt')->willReturnCallback($lookup);
		$metadata->method('getArray')->willReturnCallback($lookup);
		return $metadata;
	}

	/**
	 * Answers `Folder::search()` over `$files` the way the file cache does for the fields we query.
	 * @param list<File> $files
	 * @return \Closure(ISearchQuery): list<File>
	 */
	private function searchOver(array $files): \Closure {
		return function (ISearchQuery $query) use ($files): array {
			$this->assertSame([], $query->getSelectFields());
			$this->assertFalse($query->limitToHome());
			$hits = array_values(array_filter($files, fn (File $file): bool => $this->cacheMatches($query->getSearchOperation(), $file)));
			$this->assertCount(1, $query->getOrder());
			$order = $query->getOrder()[0];
			$this->assertSame(['fileid', ISearchOrder::DIRECTION_ASCENDING], [$order->getField(), $order->getDirection()]);
			usort($hits, $order->sortFileInfo(...));
			return array_slice($hits, $query->getOffset(), $query->getLimit());
		};
	}

	private function cacheMatches(ISearchOperator $operator, File $file): bool {
		if ($operator instanceof ISearchBinaryOperator) {
			$results = array_map(fn (ISearchOperator $argument): bool => $this->cacheMatches($argument, $file), $operator->getArguments());
			return match ($operator->getType()) {
				ISearchBinaryOperator::OPERATOR_AND => !in_array(false, $results, true),
				ISearchBinaryOperator::OPERATOR_OR => in_array(true, $results, true),
				ISearchBinaryOperator::OPERATOR_NOT => !$results[0],
			};
		}
		$this->assertInstanceOf(ISearchComparison::class, $operator);
		$value = $operator->getValue();
		$this->assertTrue(is_string($value) || is_int($value));
		$this->assertContains($operator->getType(), self::CACHE_COMPARISONS[$operator->getField()] ?? [], 'Nextcloud\'s SearchBuilder rejects it');
		return match ([$operator->getField(), $operator->getType()]) {
			['mimetype', ISearchComparison::COMPARE_LIKE] => str_starts_with($file->getMimetype(), rtrim((string)$value, '%')),
			['name', ISearchComparison::COMPARE_LIKE] => str_ends_with(strtolower($file->getName()), ltrim((string)$value, '%')),
		};
	}
}
