<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Controller;

use OCA\Honeycomb\Domain\InvalidRequestException;
use OCA\Honeycomb\Immich\ImmichException;
use OCA\Honeycomb\Service\Files\FolderNotFoundException;
use OCA\Honeycomb\Service\Files\FolderNotReadableException;
use OCA\Honeycomb\Service\Image\ImageNotFoundException;
use OCA\Honeycomb\Service\Image\ImageNotReadableException;
use OCA\Honeycomb\Service\Trash\TrashBinDisabledException;
use OCP\AppFramework\Http\JSONResponse;
use OCP\AppFramework\Http\Response;
use OCP\IUser;
use OCP\IUserSession;

/** Runs a route for the logged-in user and answers each known service failure, and an Immich failure with its code (IMMICH-001), with its status. */
final class ApiResponse {
	/** The error of each service failure; any other exception is a server error. */
	private const array ERRORS = [
		FolderNotFoundException::class => ApiError::FolderNotFound,
		ImageNotFoundException::class => ApiError::ImageNotFound,
		FolderNotReadableException::class => ApiError::FolderNotReadable,
		ImageNotReadableException::class => ApiError::ImageNotReadable,
		TrashBinDisabledException::class => ApiError::TrashBinDisabled,
	];

	public function __construct(
		private IUserSession $userSession,
	) {
	}

	/**
	 * The handler's answer for the user; the status of a known failure, or 401 without a user, with the body `{"error": code}`.
	 * @param \Closure(IUser): Response $handle
	 */
	public function forUser(\Closure $handle): Response {
		$user = $this->userSession->getUser();
		if ($user === null) {
			return ApiError::Unauthorized->response();
		}
		try {
			return $handle($user);
		} catch (ImmichException $failure) {
			return $this->immichResponse($failure);
		} catch (InvalidRequestException $refused) {
			return ApiError::Request->response(['reason' => $refused->reason->value]);
		} catch (\Exception $failure) {
			return $this->errorOf($failure)->response();
		}
	}

	/** The body is `{"error": code}`, with the missing `scope` for a 403. */
	private function immichResponse(ImmichException $failure): Response {
		$body = ['error' => $failure->error->value];
		if ($failure->scope !== null) {
			$body['scope'] = $failure->scope;
		}
		return new JSONResponse($body, $failure->error->status());
	}

	private function errorOf(\Exception $failure): ApiError {
		foreach (self::ERRORS as $class => $error) {
			if ($failure instanceof $class) {
				return $error;
			}
		}
		throw $failure;
	}
}
