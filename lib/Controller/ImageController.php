<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Controller;

use OCA\Honeycomb\Service\ImageNotFoundException;
use OCA\Honeycomb\Service\ImageNotReadableException;
use OCA\Honeycomb\Service\ImageService;
use OCA\Honeycomb\Service\ListingService;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\AppFramework\Http\FileDisplayResponse;
use OCP\AppFramework\Http\JSONResponse;
use OCP\AppFramework\Http\Response;
use OCP\IRequest;
use OCP\IUserSession;

/** @psalm-suppress UnusedClass Routed by its attributes. */
final class ImageController extends Controller {
	private const string IMMUTABLE = 'private, max-age=31536000, immutable';
	private const string REVALIDATE = 'private, no-cache';

	public function __construct(
		string $appName,
		IRequest $request,
		private IUserSession $userSession,
		private ImageService $images,
	) {
		parent::__construct($appName, $request);
	}

	/** The preview tier `size` of the image file, immutable while `v` is its mtime (ADR 0010). */
	#[NoAdminRequired]
	#[NoCSRFRequired]
	#[FrontpageRoute(verb: 'GET', url: '/api/v1/images/{fileId}', requirements: ['fileId' => '\d+'])]
	public function show(int $fileId, int $size = 0, int $v = 0): Response {
		$user = $this->userSession->getUser();
		if ($user === null) {
			return new Response(Http::STATUS_UNAUTHORIZED);
		}
		if (!in_array($size, ImageService::TIERS, true)) {
			return new Response(Http::STATUS_BAD_REQUEST);
		}
		try {
			$file = $this->images->find($user, $fileId);
			$etag = "$fileId-{$file->getMTime()}-$size";
			$cacheControl = $v === $file->getMTime() ? self::IMMUTABLE : self::REVALIDATE;
			if ($this->request->getHeader('If-None-Match') === "\"$etag\"") {
				$response = new Response(Http::STATUS_NOT_MODIFIED, ['Cache-Control' => $cacheControl]);
			} else {
				$preview = $this->images->preview($file, $size);
				$response = new FileDisplayResponse($preview, Http::STATUS_OK, ['Content-Type' => $preview->getMimeType(), 'Cache-Control' => $cacheControl]);
			}
			$response->setETag($etag);
			return $response;
		} catch (ImageNotFoundException) {
			return new Response(Http::STATUS_NOT_FOUND);
		} catch (ImageNotReadableException) {
			return new Response(Http::STATUS_FORBIDDEN);
		}
	}

	/** Queues the warming of the files' preview tiers, in the given order. */
	#[NoAdminRequired]
	#[FrontpageRoute(verb: 'POST', url: '/api/v1/previews')]
	public function warm(array $fileIds = []): JSONResponse {
		$user = $this->userSession->getUser();
		if ($user === null) {
			return new JSONResponse([], Http::STATUS_UNAUTHORIZED);
		}
		$valid = array_is_list($fileIds) && count($fileIds) <= ListingService::ENTRY_LIMIT
			&& array_filter($fileIds, static fn (mixed $id): bool => is_int($id) && $id > 0) === $fileIds;
		if (!$valid) {
			return new JSONResponse([], Http::STATUS_BAD_REQUEST);
		}
		/** @var list<int> $fileIds */
		$this->images->queueWarm($user, $fileIds);
		return new JSONResponse([], Http::STATUS_ACCEPTED);
	}
}
