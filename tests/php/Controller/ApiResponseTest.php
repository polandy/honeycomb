<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Controller;

use OCA\Honeycomb\Controller\ApiResponse;
use OCA\Honeycomb\Service\FolderNotFoundException;
use OCA\Honeycomb\Service\FolderNotReadableException;
use OCA\Honeycomb\Service\ImageNotFoundException;
use OCA\Honeycomb\Service\ImageNotReadableException;
use OCA\Honeycomb\Service\InvalidCursorException;
use OCA\Honeycomb\Service\InvalidFlagException;
use OCA\Honeycomb\Service\InvalidMoveRequestException;
use OCA\Honeycomb\Service\InvalidPositionException;
use OCA\Honeycomb\Service\InvalidPreviewRequestException;
use OCA\Honeycomb\Service\InvalidSeriesException;
use OCA\Honeycomb\Service\InvalidSettingsException;
use OCA\Honeycomb\Service\InvalidSidecarRequestException;
use OCA\Honeycomb\Service\InvalidTagsException;
use OCA\Honeycomb\Service\InvalidTrashRequestException;
use OCA\Honeycomb\Service\InvalidViewStateException;
use OCA\Honeycomb\Service\InvalidVisualHashException;
use OCA\Honeycomb\Service\TrashBinDisabledException;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\JSONResponse;
use OCP\AppFramework\Http\Response;
use OCP\IUser;
use OCP\IUserSession;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class ApiResponseTest extends TestCase {
	private function api(?IUser $user): ApiResponse {
		$session = $this->createStub(IUserSession::class);
		$session->method('getUser')->willReturn($user);
		return new ApiResponse($session);
	}

	public function testAnswersWhatTheHandlerAnswersForTheUser(): void {
		$user = $this->createStub(IUser::class);
		$answer = new JSONResponse(['ok' => true]);

		$this->assertSame($answer, $this->api($user)->forUser(fn (IUser $given): Response => $given === $user ? $answer : new Response()));
	}

	// spec: APP-004.2
	public function testWithoutAUserTheHandlerNeverRuns(): void {
		$response = $this->api(null)->forUser(function (): Response {
			$this->fail('The handler ran without a user.');
		});

		$this->assertSame(Http::STATUS_UNAUTHORIZED, $response->getStatus());
		$this->assertSame(['error' => 'unauthorized'], json_decode($response->render(), true));
	}

	/** @return array<string, array{\Throwable, int, string}> */
	public static function failures(): array {
		return [
			'cursor' => [new InvalidCursorException(), Http::STATUS_BAD_REQUEST, 'request'],
			'flag' => [new InvalidFlagException(), Http::STATUS_BAD_REQUEST, 'request'],
			'move' => [new InvalidMoveRequestException(), Http::STATUS_BAD_REQUEST, 'request'],
			'position' => [new InvalidPositionException(), Http::STATUS_BAD_REQUEST, 'request'],
			'preview' => [new InvalidPreviewRequestException(), Http::STATUS_BAD_REQUEST, 'request'],
			'series' => [new InvalidSeriesException(), Http::STATUS_BAD_REQUEST, 'request'],
			'settings' => [new InvalidSettingsException(), Http::STATUS_BAD_REQUEST, 'request'],
			'sidecar' => [new InvalidSidecarRequestException(), Http::STATUS_BAD_REQUEST, 'request'],
			'tags' => [new InvalidTagsException(), Http::STATUS_BAD_REQUEST, 'request'],
			'trash' => [new InvalidTrashRequestException(), Http::STATUS_BAD_REQUEST, 'request'],
			'view state' => [new InvalidViewStateException(), Http::STATUS_BAD_REQUEST, 'request'],
			'visual hash' => [new InvalidVisualHashException(), Http::STATUS_BAD_REQUEST, 'request'],
			'folder not found' => [new FolderNotFoundException(), Http::STATUS_NOT_FOUND, 'folder-not-found'],
			'image not found' => [new ImageNotFoundException(), Http::STATUS_NOT_FOUND, 'image-not-found'],
			'folder not readable' => [new FolderNotReadableException(), Http::STATUS_FORBIDDEN, 'folder-not-readable'],
			'image not readable' => [new ImageNotReadableException(), Http::STATUS_FORBIDDEN, 'image-not-readable'],
			'trash bin disabled' => [new TrashBinDisabledException(), Http::STATUS_CONFLICT, 'trash-bin-disabled'],
		];
	}

	// spec: APP-004.1
	#[DataProvider('failures')]
	public function testEachKnownFailureIsItsStatusWithItsErrorCode(\Throwable $failure, int $status, string $code): void {
		$response = $this->api($this->createStub(IUser::class))->forUser(function () use ($failure): Response {
			throw $failure;
		});

		$this->assertSame($status, $response->getStatus());
		$this->assertSame(['error' => $code], json_decode($response->render(), true));
	}

	public function testAnUnknownFailureIsNotCaught(): void {
		$this->expectException(\LogicException::class);

		$this->api($this->createStub(IUser::class))->forUser(function (): Response {
			throw new \LogicException();
		});
	}
}
