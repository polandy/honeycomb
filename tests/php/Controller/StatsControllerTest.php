<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Controller;

use DateTime;
use DateTimeZone;
use OCA\Honeycomb\AppInfo\Application;
use OCA\Honeycomb\Controller\ApiResponse;
use OCA\Honeycomb\Controller\StatsController;
use OCA\Honeycomb\Domain\SeriesStatus;
use OCA\Honeycomb\Service\Settings\SettingsService;
use OCA\Honeycomb\Service\Stats\StatsBaseline;
use OCA\Honeycomb\Service\Stats\StatsDay;
use OCA\Honeycomb\Service\Stats\StatsService;
use OCA\Honeycomb\Tests\Service\FakeSeriesStore;
use OCA\Honeycomb\Tests\Service\FakeStatsStore;
use OCA\Honeycomb\Tests\Service\FakeXmpCacheStore;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\AppFramework\Utility\ITimeFactory;
use OCP\Config\IUserConfig;
use OCP\IRequest;
use OCP\IUser;
use OCP\IUserSession;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;
use ReflectionMethod;

final class StatsControllerTest extends TestCase {
	private FakeStatsStore $store;
	private FakeSeriesStore $series;

	#[\Override]
	protected function setUp(): void {
		$this->store = new FakeStatsStore();
		$this->series = new FakeSeriesStore();
		$this->series->add('alice', SeriesStatus::Done, 1);
		$this->series->add('alice', SeriesStatus::Done, 2);
		$this->store->rows['alice'] = ['2026-11-01' => ['series_done' => 1], '2026-11-19' => ['trash_pictures' => 3]];
		$this->store->rows['bob'] = ['2026-11-19' => ['series_done' => 9]];
	}

	private function controller(bool $loggedIn = true): StatsController {
		$user = $this->createStub(IUser::class);
		$user->method('getUID')->willReturn('alice');
		$session = $this->createStub(IUserSession::class);
		$session->method('getUser')->willReturn($loggedIn ? $user : null);
		$config = $this->createStub(IUserConfig::class);
		$config->method('getValueString')->willReturnArgument(3);
		$time = $this->createStub(ITimeFactory::class);
		$time->method('getDateTime')->willReturn(new DateTime('2026-11-20 12:00', new DateTimeZone('UTC')));
		$stats = new StatsService($this->store, new StatsDay($config, $time), new SettingsService($config), $this->createStub(LoggerInterface::class));
		return new StatsController(Application::APP_ID, $this->createStub(IRequest::class), new ApiResponse($session), $stats, new StatsBaseline($this->series, $this->store, new FakeXmpCacheStore()));
	}

	// spec: STATS-001.4, STATS-001.6
	public function testAnswersTheUsersCountersOfThePeriodAndTheFirstDay(): void {
		$response = $this->controller()->index('2026-11-02', '2026-11-30');

		$this->assertSame(Http::STATUS_OK, $response->getStatus());
		$this->assertSame('{"counters":[{"day":"2026-11-19","metric":"trash_pictures","value":3}],"firstDay":"2026-11-01","today":"2026-11-20","seriesDoneBefore":1,"read":{"pictures":0,"picked":0,"rejected":0,"rated":0}}', $response->render());
	}

	public function testAMalformedDayIsABadRequest(): void {
		$this->assertSame(Http::STATUS_BAD_REQUEST, $this->controller()->index('19.11.2026')->getStatus());
	}

	// spec: STATS-001.4
	public function testWithoutAUserNothingIsRead(): void {
		$controller = $this->controller(loggedIn: false);

		$this->assertSame(Http::STATUS_UNAUTHORIZED, $controller->index()->getStatus());
		$this->assertArrayHasKey('alice', $this->store->rows);
	}

	// spec: STATS-001.3
	public function testTheOnlyRouteReadsAndNoneRemovesCounters(): void {
		$routed = [];
		foreach ((new \ReflectionClass(StatsController::class))->getMethods(ReflectionMethod::IS_PUBLIC) as $method) {
			if ($method->getAttributes(FrontpageRoute::class) !== []) {
				$routed[] = $method->getName();
			}
		}

		$this->assertSame(['index'], $routed);
	}

	// spec: STATS-001.4
	public function testTheCountersAreARouteForEveryUserWithTheCsrfCheck(): void {
		$method = new ReflectionMethod(StatsController::class, 'index');

		$routes = $method->getAttributes(FrontpageRoute::class);
		$this->assertCount(1, $routes);
		$this->assertSame(['verb' => 'GET', 'url' => '/api/v1/stats'], $routes[0]->getArguments());
		$this->assertCount(1, $method->getAttributes(NoAdminRequired::class));
		$this->assertCount(0, $method->getAttributes(NoCSRFRequired::class));
	}
}
