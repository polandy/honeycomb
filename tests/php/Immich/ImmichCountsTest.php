<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Immich;

use OCA\Honeycomb\Immich\AssetDecision;
use OCA\Honeycomb\Immich\AssetKind;
use OCA\Honeycomb\Immich\Connection;
use OCA\Honeycomb\Immich\ImmichClient;
use OCA\Honeycomb\Immich\ImmichCounts;
use OCA\Honeycomb\Immich\ImmichError;
use OCA\Honeycomb\Immich\ImmichSearchFilter;
use OCA\Honeycomb\Service\ColourLabel;
use OCA\Honeycomb\Service\Flag;
use OCP\AppFramework\Utility\ITimeFactory;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class ImmichCountsTest extends TestCase {
	use AssertsImmichFailure;
	use FakeImmichServer;

	private const int NOW = 1_795_000_000;
	private const int HOUR = 3_600;
	private const int MONTH = 30 * 86_400;
	private const array PERIODS = [['takenAfter' => self::NOW - self::MONTH, 'takenBefore' => null], ['takenAfter' => null, 'takenBefore' => self::NOW - self::MONTH]];

	private FakeImmichDecisionStore $decisions;

	#[\Override]
	protected function setUp(): void {
		$library = new FakeImmichLibrary();
		$library->add(self::id(1), self::NOW - self::MONTH - 10 * 86_400);
		$library->add(self::id(2), self::NOW - self::HOUR, 0, ['livePhotoVideoId' => 'motion-part']);
		$library->add(self::id(3), self::NOW - 2 * self::HOUR, 0, ['type' => 'VIDEO', 'duration' => 3000]);
		$library->add(self::id(4), self::NOW - 3 * self::HOUR, 0, ['exifInfo' => ['model' => 'Pixel 7']]);
		$library->add(self::id(5), self::NOW - 4 * self::HOUR, 0, ['exifInfo' => ['model' => null]]);
		$this->immichRoute('POST /search/statistics', static fn (array $options): array => $library->statistics($options));
		$this->immichAnswers('GET /search/suggestions', 200, ['Pixel 9 Pro', 'Pixel 7', 'Canon EOS R5']);
		$this->decisions = new FakeImmichDecisionStore();
		$this->decide(1, Flag::Picked, 4, ColourLabel::Red, AssetKind::Photo, self::NOW - self::MONTH - 10 * 86_400);
		$this->decide(2, Flag::Rejected, 0, null, AssetKind::Live, self::NOW - self::HOUR);
		$this->decide(4, Flag::Unflagged, 2, null, AssetKind::Photo, self::NOW - 3 * self::HOUR, 'Pixel 7');
	}

	// spec: IMMICH-002.13
	public function testTheNumbersAreTheServersForTheWholeLibrary(): void {
		$this->assertSame([
			'total' => 5, 'undecided' => 3, 'decided' => 2, 'matching' => 5,
			'flags' => ['picked' => 1, 'rejected' => 1, 'unflagged' => 3],
			'ratings' => ['0' => 3, '1' => 0, '2' => 1, '3' => 0, '4' => 1, '5' => 0],
			'colourLabels' => ['red' => 1],
			'devices' => [['model' => 'Pixel 9 Pro', 'count' => 3], ['model' => 'Pixel 7', 'count' => 1], ['model' => null, 'count' => 1]],
			'kinds' => ['photo' => 3, 'live' => 1, 'video' => 1],
			'periods' => [4, 1],
		], $this->counts([], self::PERIODS));
		$suggestions = array_values(array_filter($this->immichRequests, static fn (array $request): bool => str_ends_with($request['url'], '/search/suggestions')));
		$this->assertSame([['type' => 'camera-model']], array_map(static fn (array $request): mixed => $request['options']['query'] ?? null, $suggestions));
	}

	public function testTheRatingsAndColourLabelsAreObjectsOnTheWire(): void {
		$this->decisions->rows = [];

		$json = json_encode((new ImmichCounts($this->client(), new ImmichSearchFilter(), $this->decisions, $this->time()))->of($this->connection(), [], []), JSON_THROW_ON_ERROR);

		$this->assertStringContainsString('"ratings":{"0":5,', $json);
		$this->assertStringContainsString('"colourLabels":{}', $json);
	}

	// spec: IMMICH-002.14
	public function testEachFacetCountsUnderTheFiltersOfTheOtherGroups(): void {
		$counts = $this->counts(['devices' => ['Pixel 9 Pro']], self::PERIODS);

		$this->assertSame([3, 3, 1, 1, 1], [$counts['total'], $counts['matching'], $counts['flags']['picked'], $counts['flags']['rejected'], $counts['flags']['unflagged']]);
		$this->assertSame([2, 1], $counts['periods']);
		$this->assertSame([['model' => 'Pixel 9 Pro', 'count' => 3], ['model' => 'Pixel 7', 'count' => 1], ['model' => null, 'count' => 1]], $counts['devices']);
		$this->assertSame(['photo' => 1, 'live' => 1, 'video' => 1], $counts['kinds']);
	}

	/** @return array<string, array{array<string, mixed>, int}> */
	public static function decisionFilters(): array {
		return [
			'picks only' => [['flags' => ['picked']], 1],
			'unflagged, rated or not' => [['flags' => ['unflagged']], 3],
			'at least three stars' => [['rating' => ['op' => 'atLeast', 'value' => 3]], 1],
			'at most two stars' => [['rating' => ['op' => 'atMost', 'value' => 2]], 4],
			'red' => [['colourLabels' => ['red']], 1],
		];
	}

	/** @param array<string, mixed> $filters */
	#[DataProvider('decisionFilters')]
	public function testMatchingCountsTheDecisionFilterOverRowsAndUndecidedAssets(array $filters, int $matching): void {
		$counts = $this->counts($filters, []);

		$this->assertSame([5, $matching], [$counts['total'], $counts['matching']]);
	}

	// spec: IMMICH-002.24
	public function testADeviceWithoutUploadsIsOfferedOnlyWhenChosen(): void {
		$this->assertNotContains('Canon EOS R5', array_column($this->counts([], [])['devices'], 'model'));

		$chosen = $this->counts(['devices' => ['Canon EOS R5']], []);

		$this->assertContains(['model' => 'Canon EOS R5', 'count' => 0], $chosen['devices']);
		$this->assertSame(0, $chosen['total']);
	}

	/** @return array<string, array{array<string, mixed>, list<mixed>}> */
	public static function malformed(): array {
		return [
			'an unknown kind' => [['kinds' => ['screenshot']], []],
			'too many time options' => [[], array_fill(0, ImmichCounts::MAX_PERIODS + 1, ['takenAfter' => null, 'takenBefore' => null])],
			'a time that is no integer' => [[], [['takenAfter' => 'yesterday', 'takenBefore' => null]]],
			'a time option of another key' => [[], [['after' => 1, 'takenBefore' => null]]],
			'a time option that is no object' => [[], [42]],
		];
	}

	/**
	 * @param array<string, mixed> $filters
	 * @param list<mixed> $periods
	 */
	// spec: IMMICH-002.25
	#[DataProvider('malformed')]
	public function testAMalformedRequestAsksNoImmich(array $filters, array $periods): void {
		$this->assertFailsWith(ImmichError::Request, fn () => (new ImmichCounts($this->client(), new ImmichSearchFilter(), $this->decisions, $this->time()))->of($this->connection(), $filters, $periods));
		$this->assertSame([], $this->immichRequests);
	}

	public function testOnlyTheUsersRowsOfTheConnectionCount(): void {
		$this->decisions->decide('bob', 'alice-phone', new AssetDecision(self::id(9), 5, null, Flag::Picked, false, self::NOW, null, AssetKind::Photo, 'x'));
		$this->decisions->decide('alice', 'alice-tablet', new AssetDecision(self::id(9), 5, null, Flag::Picked, false, self::NOW, null, AssetKind::Photo, 'x'));

		$this->assertSame(['picked' => 1, 'rejected' => 1, 'unflagged' => 3], $this->counts([], [])['flags']);
	}

	/**
	 * The counts as the browser reads them.
	 * @param array<string, mixed> $filters
	 * @param list<mixed> $periods
	 * @return array<string, mixed>
	 */
	private function counts(array $filters, array $periods): array {
		$counts = (new ImmichCounts($this->client(), new ImmichSearchFilter(), $this->decisions, $this->time()))->of($this->connection(), $filters, $periods);
		/** @var array<string, mixed> */
		return json_decode(json_encode($counts, JSON_THROW_ON_ERROR), true, 512, JSON_THROW_ON_ERROR);
	}

	private function decide(int $n, Flag $flag, int $rating, ?ColourLabel $label, AssetKind $kind, int $takenAt, ?string $model = 'Pixel 9 Pro'): void {
		$this->decisions->decide('alice', 'alice-phone', new AssetDecision(self::id($n), $rating, $label, $flag, false, $takenAt, $model, $kind, '2026-11-19T08:00:00.000Z'));
	}

	private function client(): ImmichClient {
		$files = new FakeLocalFiles();
		$files->files['/keys/alice-phone.key'] = 'key';
		return new ImmichClient($this->immichClients(), $files, new FakeLogger());
	}

	private function time(): ITimeFactory {
		$time = $this->createStub(ITimeFactory::class);
		$time->method('getTime')->willReturn(self::NOW);
		return $time;
	}

	private function connection(): Connection {
		return new Connection('alice-phone', 'alice', 'Phone', 'http://immich-server:2283', '/keys/alice-phone.key', false);
	}

	private static function id(int $n): string {
		return sprintf('00000000-0000-4000-8000-%012d', $n);
	}
}
