<?php

declare(strict_types=1);

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace OCA\Honeycomb\Tests\Conventions;

use OCA\Honeycomb\Service\UserRowStore;
use PHPUnit\Framework\TestCase;

/** A mapper that writes a `user_id` column is a UserRowStore, so a deleted user's rows go (ADR 0040). */
final class UserRowStoreRegistryTest extends TestCase {
	private const USER_ID_COLUMN = "/'user_id'\s*=>/";

	public function testEveryMapperThatWritesUserIdsForgetsDeletedUsers(): void {
		$missing = [];
		foreach ($this->mappers() as $class => $code) {
			if (preg_match(self::USER_ID_COLUMN, $code) === 1 && !is_a($class, UserRowStore::class, true)) {
				$missing[] = $class;
			}
		}

		$this->assertSame([], $missing);
	}

	public function testFindsTheMappersOfTheTablesWithUserIds(): void {
		$classes = array_keys($this->mappers());

		$this->assertContains('OCA\Honeycomb\Db\FolderDoneMapper', $classes);
		$this->assertContains('OCA\Honeycomb\Db\XmpCacheMapper', $classes);
	}

	/** @return array<class-string, string> the source of each mapper class by name */
	private function mappers(): array {
		$mappers = [];
		/** @var iterable<\SplFileInfo> $files */
		$files = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator(dirname(__DIR__, 3) . '/lib', \FilesystemIterator::SKIP_DOTS));
		foreach ($files as $file) {
			if (!str_ends_with($file->getFilename(), 'Mapper.php')) {
				continue;
			}
			$namespace = str_replace('/', '\\', substr($file->getPath(), strlen(dirname(__DIR__, 3) . '/lib/')));
			/** @var class-string $class */
			$class = "OCA\\Honeycomb\\$namespace\\" . $file->getBasename('.php');
			$mappers[$class] = (string)$file->openFile()->fread(max(1, (int)$file->getSize()));
		}
		return $mappers;
	}
}
