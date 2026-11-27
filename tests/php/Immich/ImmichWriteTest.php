<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Immich;

use OCA\Honeycomb\Domain\Flag;
use OCA\Honeycomb\Immich\AssetDecision;
use OCA\Honeycomb\Immich\AssetKind;
use OCA\Honeycomb\Immich\Connection;
use OCA\Honeycomb\Immich\ImmichClient;
use OCA\Honeycomb\Immich\ImmichError;
use OCA\Honeycomb\Immich\ImmichWrite;
use OCA\Honeycomb\Immich\WrittenState;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class ImmichWriteTest extends TestCase {
	use AssertsImmichFailure;
	use FakeImmichServer;

	private const string REJECT = '00000000-0000-4000-8000-000000000001';
	private const string RESTORED = '00000000-0000-4000-8000-000000000002';
	private const string RATED = '00000000-0000-4000-8000-000000000003';
	private const string PICK = '00000000-0000-4000-8000-000000000004';
	private const string UNDECIDED = '00000000-0000-4000-8000-000000000005';

	private FakeImmichDecisionStore $decisions;

	#[\Override]
	protected function setUp(): void {
		$this->decisions = new FakeImmichDecisionStore();
		$this->decide(self::REJECT, Flag::Rejected, 0);
		$this->decide(self::RESTORED, Flag::Unflagged, 2);
		$this->decide(self::RATED, Flag::Rejected, 4);
		$this->decide(self::PICK, Flag::Picked, 5);
		$this->immichAnswers('DELETE /assets', 204);
		$this->immichAnswers('POST /trash/restore/assets', 200, ['count' => 1]);
		foreach ([self::REJECT, self::RESTORED, self::RATED, self::PICK] as $id) {
			$this->immichAnswers('PUT /assets/' . $id, 200, ['id' => $id]);
		}
	}

	// spec: IMMICH-004.19
	public function testItTrashesRestoresAndSetsTheFieldsOfTheBlock(): void {
		$answer = $this->write()->write($this->connection(), [
			['assetId' => self::REJECT, 'trash' => true, 'immichRating' => null],
			['assetId' => self::RESTORED, 'restore' => true, 'archived' => false, 'immichRating' => 2],
			['assetId' => self::RATED, 'archived' => true, 'rating' => 4, 'immichRating' => 4],
		]);

		$this->assertSame(['results' => [
			['assetId' => self::REJECT, 'state' => 'written'],
			['assetId' => self::RESTORED, 'state' => 'written'],
			['assetId' => self::RATED, 'state' => 'written'],
		]], $answer);
		$this->assertSame(['ids' => [self::REJECT], 'force' => false], $this->lastImmichBody('DELETE /assets'));
		$this->assertSame(['ids' => [self::RESTORED]], $this->lastImmichBody('POST /trash/restore/assets'));
		$this->assertSame(['visibility' => 'timeline'], $this->lastImmichBody('PUT /assets/' . self::RESTORED));
		$this->assertSame(['visibility' => 'archive', 'rating' => 4], $this->lastImmichBody('PUT /assets/' . self::RATED));
		$this->assertSame(['DELETE', 'POST', 'PUT', 'PUT'], array_column($this->immichRequests, 'method'));
	}

	// spec: IMMICH-004.4
	public function testAFavouriteAndARatingClearedGoInOneUpdate(): void {
		$this->write()->write($this->connection(), [['assetId' => self::PICK, 'favorite' => true, 'rating' => null, 'immichRating' => null]]);

		$this->assertSame(['isFavorite' => true, 'rating' => null], $this->lastImmichBody('PUT /assets/' . self::PICK));
	}

	// spec: IMMICH-004.9
	public function testAnAssetWithNothingToSendIsWrittenWithoutACall(): void {
		$answer = $this->write()->write($this->connection(), [['assetId' => self::PICK, 'immichRating' => 5]]);

		$this->assertSame(['results' => [['assetId' => self::PICK, 'state' => 'written']]], $answer);
		$this->assertSame([], $this->immichRequests);
	}

	// spec: IMMICH-004.21
	public function testItStoresTheSavedDecisionAndImmichsRatingOfEachWrittenAsset(): void {
		$this->immichAnswers('PUT /assets/' . self::PICK, 400, ['message' => 'Not found or no asset.update access']);

		$this->write()->write($this->connection(), [
			['assetId' => self::RATED, 'rating' => -1, 'immichRating' => -1],
			['assetId' => self::PICK, 'favorite' => true, 'immichRating' => 5],
		]);

		$this->assertEquals(new WrittenState(Flag::Rejected, 4, -1), $this->written(self::RATED));
		$this->assertNull($this->written(self::PICK));
	}

	// spec: IMMICH-004.10
	public function testARefusedUpdateFailsAloneAndTheOthersAreWritten(): void {
		$this->immichAnswers('PUT /assets/' . self::RATED, 400, ['message' => 'Not found or no asset.update access']);

		$answer = $this->write()->write($this->connection(), [
			['assetId' => self::RATED, 'rating' => 4, 'immichRating' => 4],
			['assetId' => self::PICK, 'favorite' => true, 'immichRating' => 5],
		]);

		$this->assertSame(['results' => [
			['assetId' => self::RATED, 'state' => 'failed', 'error' => 'unknown-asset'],
			['assetId' => self::PICK, 'state' => 'written'],
		]], $answer);
	}

	// spec: IMMICH-004.10
	public function testARefusedBulkTrashIsRepeatedPerAssetSoOnlyTheRefusedOneFails(): void {
		$this->decide(self::RESTORED, Flag::Rejected, 0);
		$this->immichRoute('DELETE /assets', static fn (array $options): array => in_array(self::RESTORED, (array)json_decode((string)$options['body'], true)['ids'], true)
			? [400, '{"message":"Not found or no asset.delete access"}', 'application/json'] : [204, '', 'application/json']);

		$answer = $this->write()->write($this->connection(), [
			['assetId' => self::REJECT, 'trash' => true, 'immichRating' => null],
			['assetId' => self::RESTORED, 'trash' => true, 'immichRating' => 2],
		]);

		$this->assertSame(['results' => [
			['assetId' => self::REJECT, 'state' => 'written'],
			['assetId' => self::RESTORED, 'state' => 'failed', 'error' => 'unknown-asset'],
		]], $answer);
		$this->assertSame([[self::REJECT, self::RESTORED], [self::REJECT], [self::RESTORED]], $this->trashedIds());
	}

	// spec: IMMICH-004.12
	public function testATrashWithoutAssetDeleteFailsWithTheScopeAndTheUpdatesGoOn(): void {
		$this->immichAnswers('DELETE /assets', 403, ['message' => 'Missing required permission: asset.delete']);

		$answer = $this->write()->write($this->connection(), [
			['assetId' => self::REJECT, 'trash' => true, 'immichRating' => null],
			['assetId' => self::PICK, 'favorite' => true, 'immichRating' => 5],
		]);

		$this->assertSame(['results' => [
			['assetId' => self::REJECT, 'state' => 'failed', 'error' => 'scope'],
			['assetId' => self::PICK, 'state' => 'written'],
		]], $answer);
	}

	public function testAFailedRestoreSendsNoUpdateForItsAsset(): void {
		$this->immichAnswers('POST /trash/restore/assets', 403, ['message' => 'Missing required permission: asset.delete']);

		$answer = $this->write()->write($this->connection(), [['assetId' => self::RESTORED, 'restore' => true, 'archived' => false, 'immichRating' => 2]]);

		$this->assertSame(['results' => [['assetId' => self::RESTORED, 'state' => 'failed', 'error' => 'scope']]], $answer);
		$this->assertNull($this->lastImmichBody('PUT /assets/' . self::RESTORED));
	}

	public function testOnceImmichDoesNotAnswerEveryAssetNotYetWrittenFailsWithoutAnotherCall(): void {
		$this->immichDown('PUT /assets/' . self::RATED);

		$answer = $this->write()->write($this->connection(), [
			['assetId' => self::REJECT, 'trash' => true, 'immichRating' => null],
			['assetId' => self::RATED, 'rating' => 4, 'immichRating' => 4],
			['assetId' => self::PICK, 'favorite' => true, 'immichRating' => 5],
		]);

		$this->assertSame(['results' => [
			['assetId' => self::REJECT, 'state' => 'written'],
			['assetId' => self::RATED, 'state' => 'failed', 'error' => 'unreachable'],
			['assetId' => self::PICK, 'state' => 'failed', 'error' => 'unreachable'],
		]], $answer);
		$this->assertNull($this->lastImmichBody('PUT /assets/' . self::PICK));
		$this->assertEquals(new WrittenState(Flag::Rejected, 0, null), $this->written(self::REJECT));
	}

	// spec: IMMICH-004.20
	public function testOnlyAnAssetSavedAsARejectIsTrashed(): void {
		$answer = $this->write()->write($this->connection(), [
			['assetId' => self::PICK, 'trash' => true, 'immichRating' => 5],
			['assetId' => self::UNDECIDED, 'trash' => true, 'immichRating' => null],
		]);

		$this->assertSame(['results' => [
			['assetId' => self::PICK, 'state' => 'failed', 'error' => 'request'],
			['assetId' => self::UNDECIDED, 'state' => 'failed', 'error' => 'unknown-asset'],
		]], $answer);
		$this->assertSame([], $this->immichRequests);
	}

	/** @return array<string, array{mixed}> */
	public static function malformed(): array {
		$trash = ['assetId' => self::REJECT, 'trash' => true, 'immichRating' => null];
		return [
			'no body' => [null],
			'no asset' => [[]],
			'not a list' => [['a' => $trash]],
			'an asset twice' => [[$trash, $trash]],
			'more than 100' => [array_map(static fn (int $n): array => ['assetId' => sprintf('00000000-0000-4000-8000-%012d', $n), 'immichRating' => null], range(1, 101))],
			'a malformed id' => [[['assetId' => 'IMG_0001', 'immichRating' => null]]],
			'force' => [[[...$trash, 'force' => true]]],
			'an unknown field' => [[['assetId' => self::PICK, 'isFavorite' => true, 'immichRating' => 5]]],
			'no Immich rating' => [[['assetId' => self::PICK, 'favorite' => true]]],
			'a trash beside an update' => [[[...$trash, 'archived' => true]]],
			'a trash that is false' => [[[...$trash, 'trash' => false]]],
			'a restore that is false' => [[['assetId' => self::RESTORED, 'restore' => false, 'immichRating' => 2]]],
			'a rating of 0' => [[['assetId' => self::RATED, 'rating' => 0, 'immichRating' => 0]]],
			'a rating above 5' => [[['assetId' => self::RATED, 'rating' => 6, 'immichRating' => 6]]],
			'a rating unlike Immichs' => [[['assetId' => self::RATED, 'rating' => 4, 'immichRating' => 3]]],
			'a favourite that is no boolean' => [[['assetId' => self::PICK, 'favorite' => 1, 'immichRating' => 5]]],
		];
	}

	// spec: IMMICH-004.2, IMMICH-004.5, IMMICH-004.19
	#[DataProvider('malformed')]
	public function testAMalformedBodyIsABadRequestAndSendsNothing(mixed $body): void {
		$this->assertFailsWith(ImmichError::Request, fn (): array => $this->write()->write($this->connection(), $body));
		$this->assertSame([], $this->immichRequests);
	}

	// spec: IMMICH-004.5
	public function testOneHundredAssetsAreOneRequest(): void {
		$assets = array_map(static fn (int $n): array => ['assetId' => sprintf('00000000-0000-4000-8000-%012d', $n), 'immichRating' => null], range(1, 100));

		$this->assertCount(100, $this->write()->write($this->connection(), $assets)['results']);
	}

	private function decide(string $assetId, Flag $flag, int $rating): void {
		$this->decisions->decide('alice', 'alice-phone', new AssetDecision($assetId, $rating, null, $flag, false, 1_795_000_000, null, AssetKind::Photo, '2026-11-21T20:33:35.789Z'));
	}

	private function written(string $assetId): ?WrittenState {
		return $this->decisions->find('alice', 'alice-phone', [$assetId])[$assetId]->written;
	}

	/** @return list<list<string>> */
	private function trashedIds(): array {
		$bodies = array_filter($this->immichRequests, static fn (array $request): bool => $request['method'] === 'DELETE');
		return array_values(array_map(static fn (array $request): array => (array)json_decode((string)$request['options']['body'], true)['ids'], $bodies));
	}

	private function write(): ImmichWrite {
		$files = new FakeLocalFiles();
		$files->files['/keys/alice-phone.key'] = 'key';
		return new ImmichWrite(new ImmichClient($this->immichClients(), $files, new FakeLogger()), $this->decisions);
	}

	private function connection(): Connection {
		return new Connection('alice-phone', 'alice', 'Phone', 'http://immich-server:2283', '/keys/alice-phone.key', false);
	}
}
