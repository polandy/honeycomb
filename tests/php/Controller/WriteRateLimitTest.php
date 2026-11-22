<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Controller;

use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\UserRateLimit;
use PHPUnit\Framework\TestCase;
use ReflectionClass;
use ReflectionMethod;

final class WriteRateLimitTest extends TestCase {
	/** The routes that are not `GET` but only read, each `Controller::method`. */
	private const array READING = [
		'EmbeddedXmpController::lookup',
		'ImageController::warm',
		'ImmichController::assets',
		'ImmichController::counts',
		'MoveController::targets',
		'SeriesController::lookup',
		'SidecarController::lookup',
		'XmpCacheController::lookup',
	];

	/** @return array<string, ReflectionMethod> every routed method that is not `GET`, by `Controller::method` */
	private static function changingRoutes(): array {
		$routes = [];
		foreach (new \FilesystemIterator(__DIR__ . '/../../../lib/Controller') as $file) {
			$name = $file instanceof \SplFileInfo ? 'OCA\\Honeycomb\\Controller\\' . $file->getBasename('.php') : '';
			if (!str_ends_with($name, 'Controller') || !class_exists($name)) {
				continue;
			}
			$class = new ReflectionClass($name);
			foreach ($class->getMethods(ReflectionMethod::IS_PUBLIC) as $method) {
				$verbs = array_map(static fn ($attribute): mixed => $attribute->getArguments()['verb'] ?? 'GET', $method->getAttributes(FrontpageRoute::class));
				$route = $class->getShortName() . '::' . $method->getName();
				if (array_diff($verbs, ['GET']) !== [] && !in_array($route, self::READING, true)) {
					$routes[$route] = $method;
				}
			}
		}
		ksort($routes);
		return $routes;
	}

	// spec: APP-001.9
	public function testLimitsEveryWritingRouteToSixHundredRequestsAMinutePerUser(): void {
		$limits = array_map(static fn (ReflectionMethod $method): array => array_map(static fn ($limit): array => $limit->getArguments(), $method->getAttributes(UserRateLimit::class)), self::changingRoutes());

		$this->assertSame([
			'CleanupController::cleanup' => [['limit' => 600, 'period' => 60]],
			'FlagController::save' => [['limit' => 600, 'period' => 60]],
			'FlagController::takeOver' => [['limit' => 600, 'period' => 60]],
			'ImmichController::decisions' => [['limit' => 600, 'period' => 60]],
			'LibraryController::scan' => [['limit' => 600, 'period' => 60]],
			'MoveController::move' => [['limit' => 600, 'period' => 60]],
			'OrphanedSidecarController::trash' => [['limit' => 600, 'period' => 60]],
			'PositionController::save' => [['limit' => 600, 'period' => 60]],
			'QualityController::save' => [['limit' => 300, 'period' => 60]],
			'SeriesController::save' => [['limit' => 600, 'period' => 60]],
			'SettingsController::save' => [['limit' => 600, 'period' => 60]],
			'SidecarController::save' => [['limit' => 600, 'period' => 60]],
			'StatsController::reset' => [['limit' => 600, 'period' => 60]],
			'TrashController::trash' => [['limit' => 600, 'period' => 60]],
			'ViewStateController::save' => [['limit' => 600, 'period' => 60]],
			'VisualHashController::save' => [['limit' => 300, 'period' => 60]],
			'XmpCacheController::clear' => [['limit' => 600, 'period' => 60]],
			'XmpCacheController::save' => [['limit' => 600, 'period' => 60]],
		], $limits);
	}
}
