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
		'DecisionController::lookup',
		'EmbeddedXmpController::lookup',
		'ImageController::warm',
		'MoveController::targets',
		'SeriesController::lookup',
		'SidecarController::lookup',
		'TagController::lookup',
	];

	/** @return array<string, ReflectionMethod> every routed method that is not `GET`, by `Controller::method` */
	private static function changingRoutes(): array {
		$routes = [];
		foreach (glob(__DIR__ . '/../../../lib/Controller/*Controller.php') ?: [] as $path) {
			$class = new ReflectionClass('OCA\\Honeycomb\\Controller\\' . basename($path, '.php'));
			foreach ($class->getMethods(ReflectionMethod::IS_PUBLIC) as $method) {
				$verbs = array_map(static fn ($route): mixed => $route->getArguments()['verb'] ?? 'GET', $method->getAttributes(FrontpageRoute::class));
				$name = $class->getShortName() . '::' . $method->getName();
				if (array_diff($verbs, ['GET']) !== [] && !in_array($name, self::READING, true)) {
					$routes[$name] = $method;
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
			'DecisionController::save' => [['limit' => 600, 'period' => 60]],
			'MoveController::move' => [['limit' => 600, 'period' => 60]],
			'PositionController::save' => [['limit' => 600, 'period' => 60]],
			'SeriesController::save' => [['limit' => 600, 'period' => 60]],
			'SettingsController::save' => [['limit' => 600, 'period' => 60]],
			'SidecarController::save' => [['limit' => 600, 'period' => 60]],
			'TagController::save' => [['limit' => 600, 'period' => 60]],
			'TrashController::trash' => [['limit' => 600, 'period' => 60]],
			'ViewStateController::save' => [['limit' => 600, 'period' => 60]],
			'VisualHashController::save' => [['limit' => 300, 'period' => 60]],
		], $limits);
	}
}
