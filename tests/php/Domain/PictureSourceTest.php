<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Domain;

use OCA\Honeycomb\Domain\CountedPictureSource;
use OCA\Honeycomb\Domain\PictureSource;
use OCA\Honeycomb\Immich\ImmichPictureSource;
use OCA\Honeycomb\Service\Source\FolderPictureSource;
use PHPUnit\Framework\TestCase;

final class PictureSourceTest extends TestCase {
	public function testTheFoldersAreAPictureSourceThatCountsInTheBrowser(): void {
		$this->assertSame([PictureSource::class], array_values(class_implements(FolderPictureSource::class)));
	}

	public function testImmichIsAPictureSourceThatCountsOnTheServer(): void {
		$implemented = array_values(class_implements(ImmichPictureSource::class));
		sort($implemented);

		$this->assertSame([CountedPictureSource::class, PictureSource::class], $implemented);
	}

	public function testAPictureSourceListsShowsAnImageAndDecides(): void {
		$methods = static fn (string $interface): array => array_map(static fn (\ReflectionMethod $method): string => $method->getName(), (new \ReflectionClass($interface))->getMethods());

		$this->assertSame(['listing', 'image', 'decide'], $methods(PictureSource::class));
		$this->assertSame(['counts', 'listing', 'image', 'decide'], $methods(CountedPictureSource::class));
	}
}
