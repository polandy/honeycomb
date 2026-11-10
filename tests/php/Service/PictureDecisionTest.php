<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\ColourLabel;
use OCA\Honeycomb\Service\Flag;
use OCA\Honeycomb\Service\InvalidDecisionException;
use OCA\Honeycomb\Service\PictureDecision;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class PictureDecisionTest extends TestCase {
	private const array PICKED_RED = ['fileId' => 7, 'rating' => 3, 'colourLabel' => 'red', 'flag' => 'picked', 'keepRaw' => true];

	public function testReadsAWholeDecisionFromARequest(): void {
		$decision = PictureDecision::fromRequest(self::PICKED_RED);

		$this->assertEquals(new PictureDecision(7, 3, ColourLabel::Red, Flag::Picked, true), $decision);
		$this->assertSame(self::PICKED_RED, $decision->jsonSerialize());
	}

	public function testReadsNoColourLabelAsNull(): void {
		$decision = PictureDecision::fromRequest(['colourLabel' => null] + self::PICKED_RED);

		$this->assertNull($decision->colourLabel);
		$this->assertNull($decision->jsonSerialize()['colourLabel']);
	}

	/** @return array<string, array{mixed}> */
	public static function malformedDecisions(): array {
		return [
			'not an object' => [7],
			'missing file id' => [array_diff_key(self::PICKED_RED, ['fileId' => 0])],
			'file id zero' => [['fileId' => 0] + self::PICKED_RED],
			'file id as text' => [['fileId' => '7'] + self::PICKED_RED],
			'rating below 0' => [['rating' => -1] + self::PICKED_RED],
			'rating above 5' => [['rating' => 6] + self::PICKED_RED],
			'unknown colour label' => [['colourLabel' => 'purple'] + self::PICKED_RED],
			'colour label by number' => [['colourLabel' => 1] + self::PICKED_RED],
			'unknown flag' => [['flag' => 'pending'] + self::PICKED_RED],
			'missing flag' => [array_diff_key(self::PICKED_RED, ['flag' => 0])],
			'keep RAW as number' => [['keepRaw' => 1] + self::PICKED_RED],
		];
	}

	#[DataProvider('malformedDecisions')]
	public function testRejectsAMalformedDecision(mixed $item): void {
		$this->expectException(InvalidDecisionException::class);

		PictureDecision::fromRequest($item);
	}

	public function testOnlyTheUntouchedDecisionIsTheDefault(): void {
		$this->assertTrue((new PictureDecision(7, 0, null, Flag::Unflagged, false))->isDefault());
		$this->assertFalse((new PictureDecision(7, 1, null, Flag::Unflagged, false))->isDefault());
		$this->assertFalse((new PictureDecision(7, 0, ColourLabel::Gray, Flag::Unflagged, false))->isDefault());
		$this->assertFalse((new PictureDecision(7, 0, null, Flag::Rejected, false))->isDefault());
		$this->assertFalse((new PictureDecision(7, 0, null, Flag::Unflagged, true))->isDefault());
	}
}
