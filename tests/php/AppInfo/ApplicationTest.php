<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\AppInfo;

use OCA\Honeycomb\AppInfo\Application;
use OCA\Honeycomb\Db\DecisionMapper;
use OCA\Honeycomb\Db\PositionMapper;
use OCA\Honeycomb\Listener\ForgetDeletedUser;
use OCA\Honeycomb\Preview\JpegDecoder;
use OCA\Honeycomb\Preview\OcpJpegDecoder;
use OCA\Honeycomb\Preview\RawPreviewProvider;
use OCA\Honeycomb\Service\DecisionStore;
use OCA\Honeycomb\Service\PositionStore;
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

		$this->assertSame([JpegDecoder::class => OcpJpegDecoder::class, DecisionStore::class => DecisionMapper::class, PositionStore::class => PositionMapper::class], $aliases);
	}

	// spec: DECISIONS-001.12, DECISIONS-002.13
	public function testForgetsTheRowsOfADeletedUser(): void {
		$context = $this->createMock(IRegistrationContext::class);
		$context->expects($this->once())->method('registerEventListener')->with(UserDeletedEvent::class, ForgetDeletedUser::class);

		(new \ReflectionClass(Application::class))->newInstanceWithoutConstructor()->register($context);
	}
}
