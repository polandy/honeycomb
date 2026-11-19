<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\AppInfo;

use OCA\Honeycomb\AppInfo\Application;
use OCA\Honeycomb\Db\FileCacheLookup;
use OCA\Honeycomb\Db\FileCachePhotoFiles;
use OCA\Honeycomb\Db\FlagMapper;
use OCA\Honeycomb\Db\PositionMapper;
use OCA\Honeycomb\Db\SeriesMapper;
use OCA\Honeycomb\Db\StatsMapper;
use OCA\Honeycomb\Db\TagMapper;
use OCA\Honeycomb\Db\VisualHashMapper;
use OCA\Honeycomb\Db\XmpCacheMapper;
use OCA\Honeycomb\Listener\ForgetDeletedUser;
use OCA\Honeycomb\Preview\JpegDecoder;
use OCA\Honeycomb\Preview\OcpJpegDecoder;
use OCA\Honeycomb\Preview\RawPreviewProvider;
use OCA\Honeycomb\Service\ExistingFiles;
use OCA\Honeycomb\Service\FlagStore;
use OCA\Honeycomb\Service\Pause;
use OCA\Honeycomb\Service\PhotoFilesBelow;
use OCA\Honeycomb\Service\PositionStore;
use OCA\Honeycomb\Service\SeriesStore;
use OCA\Honeycomb\Service\StatsStore;
use OCA\Honeycomb\Service\SystemPause;
use OCA\Honeycomb\Service\TagStore;
use OCA\Honeycomb\Service\VisualHashStore;
use OCA\Honeycomb\Service\XmpCacheStore;
use OCP\AppFramework\Bootstrap\IRegistrationContext;
use OCP\User\Events\UserDeletedEvent;
use PHPUnit\Framework\TestCase;

final class ApplicationTest extends TestCase {
	// spec: IMAGES-001.6
	public function testRegistersThePreviewProviderForRawFiles(): void {
		$context = $this->createMock(IRegistrationContext::class);
		$context->expects($this->once())->method('registerPreviewProvider')->with(RawPreviewProvider::class, RawPreviewProvider::MIME_TYPE_REGEX);
		$aliases = [];
		$context->method('registerServiceAlias')->willReturnCallback(static function (string $alias, string $target) use (&$aliases): void {
			$aliases[$alias] = $target;
		});

		(new \ReflectionClass(Application::class))->newInstanceWithoutConstructor()->register($context);

		$this->assertSame([JpegDecoder::class => OcpJpegDecoder::class, FlagStore::class => FlagMapper::class, PositionStore::class => PositionMapper::class, SeriesStore::class => SeriesMapper::class, StatsStore::class => StatsMapper::class, TagStore::class => TagMapper::class, VisualHashStore::class => VisualHashMapper::class, XmpCacheStore::class => XmpCacheMapper::class, ExistingFiles::class => FileCacheLookup::class, PhotoFilesBelow::class => FileCachePhotoFiles::class, Pause::class => SystemPause::class], $aliases);
	}

	// spec: DECISIONS-002.13
	public function testForgetsTheRowsOfADeletedUser(): void {
		$context = $this->createMock(IRegistrationContext::class);
		$context->expects($this->once())->method('registerEventListener')->with(UserDeletedEvent::class, ForgetDeletedUser::class);

		(new \ReflectionClass(Application::class))->newInstanceWithoutConstructor()->register($context);
	}
}
