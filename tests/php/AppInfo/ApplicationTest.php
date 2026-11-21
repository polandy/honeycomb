<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\AppInfo;

use OCA\Honeycomb\AppInfo\Application;
use OCA\Honeycomb\Db\AppDataMapper;
use OCA\Honeycomb\Db\FileCacheLookup;
use OCA\Honeycomb\Db\FileCachePhotoFiles;
use OCA\Honeycomb\Db\FlagMapper;
use OCA\Honeycomb\Db\ImmichDecisionMapper;
use OCA\Honeycomb\Db\PositionMapper;
use OCA\Honeycomb\Db\QualityMapper;
use OCA\Honeycomb\Db\SeriesMapper;
use OCA\Honeycomb\Db\StatsMapper;
use OCA\Honeycomb\Db\TagMapper;
use OCA\Honeycomb\Db\VisualHashMapper;
use OCA\Honeycomb\Db\XmpCacheMapper;
use OCA\Honeycomb\Immich\ImmichDecisionStore;
use OCA\Honeycomb\Immich\LocalFiles;
use OCA\Honeycomb\Immich\PhpLocalFiles;
use OCA\Honeycomb\Listener\ForgetDeletedUser;
use OCA\Honeycomb\Listener\RenderWrittenPhotos;
use OCA\Honeycomb\Preview\JpegDecoder;
use OCA\Honeycomb\Preview\OcpJpegDecoder;
use OCA\Honeycomb\Preview\RawPreviewProvider;
use OCA\Honeycomb\Service\AppData;
use OCA\Honeycomb\Service\ExistingFiles;
use OCA\Honeycomb\Service\FlagStore;
use OCA\Honeycomb\Service\Pause;
use OCA\Honeycomb\Service\PhotoFilesBelow;
use OCA\Honeycomb\Service\PositionStore;
use OCA\Honeycomb\Service\PreviewLock;
use OCA\Honeycomb\Service\QualityStore;
use OCA\Honeycomb\Service\SemaphorePreviewLock;
use OCA\Honeycomb\Service\SeriesStore;
use OCA\Honeycomb\Service\StatsStore;
use OCA\Honeycomb\Service\SystemPause;
use OCA\Honeycomb\Service\TagStore;
use OCA\Honeycomb\Service\VisualHashStore;
use OCA\Honeycomb\Service\XmpCacheStore;
use OCP\AppFramework\Bootstrap\IRegistrationContext;
use OCP\Files\Events\Node\NodeWrittenEvent;
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

		$this->assertSame([JpegDecoder::class => OcpJpegDecoder::class, FlagStore::class => FlagMapper::class, PositionStore::class => PositionMapper::class, SeriesStore::class => SeriesMapper::class, StatsStore::class => StatsMapper::class, TagStore::class => TagMapper::class, QualityStore::class => QualityMapper::class, AppData::class => AppDataMapper::class, VisualHashStore::class => VisualHashMapper::class, XmpCacheStore::class => XmpCacheMapper::class, ExistingFiles::class => FileCacheLookup::class, PhotoFilesBelow::class => FileCachePhotoFiles::class, Pause::class => SystemPause::class, PreviewLock::class => SemaphorePreviewLock::class, LocalFiles::class => PhpLocalFiles::class, ImmichDecisionStore::class => ImmichDecisionMapper::class], $aliases);
	}

	// spec: DECISIONS-002.13
	public function testForgetsTheRowsOfADeletedUser(): void {
		$this->assertContains([UserDeletedEvent::class, ForgetDeletedUser::class], $this->listeners());
	}

	// spec: IMAGES-001.16
	public function testRendersWrittenPhotosInTheBackground(): void {
		$this->assertContains([NodeWrittenEvent::class, RenderWrittenPhotos::class], $this->listeners());
	}

	/** @return list<array{string, string}> the event listeners the app registers, by event and listener class */
	private function listeners(): array {
		$listeners = [];
		$context = $this->createStub(IRegistrationContext::class);
		$context->method('registerEventListener')->willReturnCallback(static function (string $event, string $listener) use (&$listeners): void {
			$listeners[] = [$event, $listener];
		});

		(new \ReflectionClass(Application::class))->newInstanceWithoutConstructor()->register($context);
		return $listeners;
	}
}
