<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Controller;

use OCA\Honeycomb\Service\FolderSet;
use OCA\Honeycomb\Service\InvalidListingRequestException;
use OCA\Honeycomb\Service\ListingService;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\JSONResponse;
use OCP\AppFramework\Http\Response;
use OCP\IRequest;
use OCP\IUser;

/** @psalm-suppress UnusedClass Routed by its attributes. */
final class EntryController extends Controller {
	public function __construct(
		string $appName,
		IRequest $request,
		private ApiResponse $api,
		private ListingService $listingService,
	) {
		parent::__construct($appName, $request);
	}

	/** The entries of `path`, with `subfolders=1` of every folder below but the `excluded[]` ones. */
	#[NoAdminRequired]
	#[FrontpageRoute(verb: 'GET', url: '/api/v1/entries')]
	public function index(string $path = '', bool $subfolders = false): Response {
		return $this->api->forUser(function (IUser $user) use ($path, $subfolders): Response {
			$excluded = FolderSet::folderPaths($this->request->getParam('excluded', []))
				?? throw new InvalidListingRequestException('excluded must list at most ' . FolderSet::MAX_FOLDERS . ' folder paths without ..');
			return new JSONResponse($this->listingService->list($user, $path, $subfolders, $excluded));
		});
	}
}
