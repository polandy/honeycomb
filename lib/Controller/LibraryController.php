<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Controller;

use OCA\Honeycomb\Service\LibraryFolderService;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\UserRateLimit;
use OCP\AppFramework\Http\JSONResponse;
use OCP\AppFramework\Http\Response;
use OCP\IRequest;
use OCP\IUser;

/** @psalm-suppress UnusedClass Routed by its attributes. */
final class LibraryController extends Controller {
	public function __construct(
		string $appName,
		IRequest $request,
		private ApiResponse $api,
		private LibraryFolderService $library,
	) {
		parent::__construct($appName, $request);
	}

	/** One page of the summarised folders below `$root`, with the user's live decisions (FOLDERS-001). */
	#[NoAdminRequired]
	#[FrontpageRoute(verb: 'GET', url: '/api/v1/library/folders')]
	public function folders(string $root, string $after = '', string $limit = ''): Response {
		return $this->api->forUser(fn (IUser $user): Response => new JSONResponse($this->library->list($user, $root, $after, $limit)));
	}

	/** Summarises the next batch of folders below `$root` that changed since their last scan (FOLDERS-001.5). */
	#[NoAdminRequired]
	#[UserRateLimit(limit: WriteRateLimit::LIMIT, period: WriteRateLimit::PERIOD_SECONDS)]
	#[FrontpageRoute(verb: 'POST', url: '/api/v1/library/scan')]
	public function scan(string $root): Response {
		return $this->api->forUser(fn (IUser $user): Response => new JSONResponse($this->library->scan($user, $root)));
	}
}
