<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Controller;

use OCA\Honeycomb\Service\Settings\LibraryRootsGuard;
use OCA\Honeycomb\Service\Trash\OrphanedSidecarScan;
use OCA\Honeycomb\Service\Trash\OrphanedSidecarTrash;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\UserRateLimit;
use OCP\AppFramework\Http\JSONResponse;
use OCP\AppFramework\Http\Response;
use OCP\IRequest;
use OCP\IUser;

/** @psalm-suppress UnusedClass Routed by its attributes. */
final class OrphanedSidecarController extends Controller {
	public function __construct(
		string $appName,
		IRequest $request,
		private ApiResponse $api,
		private OrphanedSidecarScan $scan,
		private OrphanedSidecarTrash $trash,
		private LibraryRootsGuard $roots,
	) {
		parent::__construct($appName, $request);
	}

	/** The next page of the orphaned sidecars below `$path`, changing nothing (XMP-009). */
	#[NoAdminRequired]
	#[FrontpageRoute(verb: 'GET', url: '/api/v1/sidecars/orphaned')]
	public function orphaned(string $path = '', string $cursor = ''): Response {
		return $this->api->forUser(function (IUser $user) use ($path, $cursor): Response {
			$this->roots->ensureInside($user, $path);
			return new JSONResponse($this->scan->page($user, $path, $cursor));
		});
	}

	/** Moves the confirmed sidecars that are still orphaned into the trash bin and reports each (XMP-009). */
	#[NoAdminRequired]
	#[FrontpageRoute(verb: 'POST', url: '/api/v1/sidecars/orphaned/trash')]
	#[UserRateLimit(limit: WriteRateLimit::LIMIT, period: WriteRateLimit::PERIOD_SECONDS)]
	public function trash(array $sidecars = []): Response {
		return $this->api->forUser(fn (IUser $user): Response => new JSONResponse(['sidecars' => $this->trash->trash($user, $sidecars)]));
	}
}
