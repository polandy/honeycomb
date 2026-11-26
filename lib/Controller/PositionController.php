<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Controller;

use OCA\Honeycomb\Domain\ResumePosition;
use OCA\Honeycomb\Immich\ImmichPosition;
use OCA\Honeycomb\Immich\ImmichPositions;
use OCA\Honeycomb\Service\Folder\PositionService;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\UserRateLimit;
use OCP\AppFramework\Http\JSONResponse;
use OCP\AppFramework\Http\Response;
use OCP\IRequest;
use OCP\IUser;

/** @psalm-suppress UnusedClass Routed by its attributes. */
final class PositionController extends Controller {
	public function __construct(
		string $appName,
		IRequest $request,
		private ApiResponse $api,
		private PositionService $positions,
		private ImmichPositions $immichPositions,
	) {
		parent::__construct($appName, $request);
	}

	/** The user's resume positions of folder sets and connections, the latest saved first (ADR 0012, IMMICH-003.15). */
	#[NoAdminRequired]
	#[FrontpageRoute(verb: 'GET', url: '/api/v1/positions')]
	public function index(): Response {
		return $this->api->forUser(function (IUser $user): Response {
			$positions = [...$this->positions->recent($user), ...$this->immichPositions->recent($user)];
			// Stable, so each store's own order holds within a second.
			usort($positions, static fn (ResumePosition|ImmichPosition $a, ResumePosition|ImmichPosition $b): int => $b->updatedAt <=> $a->updatedAt);
			return new JSONResponse(['positions' => $positions]);
		});
	}

	/**
	 * Stores where the user stands in the folder set (ADR 0012) and counts the active time since the last save (STATS-001.39);
	 * with `immich`, where they stand in that connection, without active time (IMMICH-003.23).
	 */
	#[NoAdminRequired]
	#[FrontpageRoute(verb: 'PUT', url: '/api/v1/positions')]
	#[UserRateLimit(limit: WriteRateLimit::LIMIT, period: WriteRateLimit::PERIOD_SECONDS)]
	public function save(array $folderSet = [], int $fileId = 0, int $decided = 0, int $total = 0, int $activeSeconds = 0, ?string $immich = null, string $assetId = '', int $takenAt = -1): Response {
		return $this->api->forUser(fn (IUser $user): Response => new JSONResponse($immich === null
			? $this->positions->save($user, $folderSet, $fileId, $decided, $total, $activeSeconds)
			: $this->immichPositions->save($user, $immich, $assetId, $takenAt, $decided, $total)));
	}
}
