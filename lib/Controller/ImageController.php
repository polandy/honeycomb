<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Controller;

use OCA\Honeycomb\Service\ImageService;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\AppFramework\Http\FileDisplayResponse;
use OCP\AppFramework\Http\JSONResponse;
use OCP\AppFramework\Http\Response;
use OCP\IRequest;
use OCP\IUser;

/** @psalm-suppress UnusedClass Routed by its attributes. */
final class ImageController extends Controller {
	private const string IMMUTABLE = 'private, max-age=31536000, immutable';
	private const string REVALIDATE = 'private, no-cache';

	public function __construct(
		string $appName,
		IRequest $request,
		private ApiResponse $api,
		private ImageService $images,
	) {
		parent::__construct($appName, $request);
	}

	/** The preview tier `size` (0: the full image) of the image file, immutable while `v` is its mtime (ADR 0010). */
	#[NoAdminRequired]
	#[NoCSRFRequired]
	#[FrontpageRoute(verb: 'GET', url: '/api/v1/images/{fileId}', requirements: ['fileId' => '\d+'])]
	public function show(int $fileId, int $size = -1, int $v = 0): Response {
		return $this->api->forUser(function (IUser $user) use ($fileId, $size, $v): Response {
			if ($size !== ImageService::FULL && !in_array($size, ImageService::TIERS, true)) {
				return new Response(Http::STATUS_BAD_REQUEST);
			}
			$file = $this->images->find($user, $fileId);
			$etag = "$fileId-{$file->getMTime()}-$size";
			$cacheControl = $v === $file->getMTime() ? self::IMMUTABLE : self::REVALIDATE;
			if ($this->request->getHeader('If-None-Match') === "\"$etag\"") {
				$response = new Response(Http::STATUS_NOT_MODIFIED, ['Cache-Control' => $cacheControl]);
			} else {
				$image = $size === ImageService::FULL ? $this->images->full($file) : $this->images->preview($file, $size);
				$response = new FileDisplayResponse($image, Http::STATUS_OK, ['Content-Type' => $image->getMimeType(), 'Cache-Control' => $cacheControl]);
			}
			$response->setETag($etag);
			return $response;
		});
	}

	/** Renders the preview tiers of the files, in the given order, before it answers. */
	#[NoAdminRequired]
	#[FrontpageRoute(verb: 'POST', url: '/api/v1/previews')]
	public function warm(array $fileIds = []): Response {
		return $this->api->forUser(function (IUser $user) use ($fileIds): Response {
			$this->images->warm($user, $fileIds);
			return new JSONResponse([]);
		});
	}
}
