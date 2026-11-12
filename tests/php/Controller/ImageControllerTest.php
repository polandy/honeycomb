<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Controller;

use OCA\Honeycomb\AppInfo\Application;
use OCA\Honeycomb\Controller\ImageController;
use OCA\Honeycomb\Service\ImageService;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\AppFramework\Http\Response;
use OCP\Files\File;
use OCP\Files\Folder;
use OCP\Files\IRootFolder;
use OCP\Files\Node;
use OCP\Files\NotFoundException;
use OCP\Files\SimpleFS\ISimpleFile;
use OCP\IPreview;
use OCP\IRequest;
use OCP\IUser;
use OCP\IUserSession;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

final class ImageControllerTest extends TestCase {
	private const int MTIME = 1_700_000_000;

	/** @param array<int, Node> $nodes alice's nodes by file id */
	private function controller(array $nodes, ?IPreview $preview = null, ?string $ifNoneMatch = null, bool $loggedIn = true): ImageController {
		$user = $this->createStub(IUser::class);
		$user->method('getUID')->willReturn('alice');
		$session = $this->createStub(IUserSession::class);
		$session->method('getUser')->willReturn($loggedIn ? $user : null);
		$request = $this->createStub(IRequest::class);
		$request->method('getHeader')->willReturnMap([['If-None-Match', $ifNoneMatch ?? '']]);
		$userFolder = $this->createStub(Folder::class);
		$userFolder->method('getFirstNodeById')->willReturnCallback(static fn (int $id): ?Node => $nodes[$id] ?? null);
		$root = $this->createStub(IRootFolder::class);
		$root->method('getUserFolder')->willReturnMap([['alice', $userFolder]]);
		$images = new ImageService(
			$root,
			$preview ?? $this->previewOf('image/jpeg'),
			$this->createStub(LoggerInterface::class),
		);
		return new ImageController(Application::APP_ID, $request, $session, $images);
	}

	private function image(bool $readable = true): File {
		$file = $this->createStub(File::class);
		$file->method('getId')->willReturn(7);
		$file->method('getName')->willReturn('IMG_0001.JPG');
		$file->method('getMimetype')->willReturn('image/jpeg');
		$file->method('getMTime')->willReturn(self::MTIME);
		$file->method('isReadable')->willReturn($readable);
		return $file;
	}

	private function previewOf(string $mime): IPreview {
		$rendered = $this->createStub(ISimpleFile::class);
		$rendered->method('getName')->willReturn('1024-1024.jpg');
		$rendered->method('getMimeType')->willReturn($mime);
		$rendered->method('getMTime')->willReturn(self::MTIME + 60);
		$rendered->method('getEtag')->willReturn('preview-etag');
		$preview = $this->createStub(IPreview::class);
		$preview->method('getPreview')->willReturn($rendered);
		return $preview;
	}

	/** @return array<string, mixed> the headers the controller set, without the framework's defaults */
	private function headersOf(Response $response): array {
		/** @var array<string, mixed> */
		return (new \ReflectionProperty(Response::class, 'headers'))->getValue($response);
	}

	// spec: IMAGES-001.1
	public function testServesATierUnderAnImmutableUrl(): void {
		$response = $this->controller([7 => $this->image()], $this->previewOf('image/webp'))->show(7, 1024, self::MTIME);

		$this->assertSame(Http::STATUS_OK, $response->getStatus());
		$this->assertSame('7-' . self::MTIME . '-1024', $response->getETag());
		$headers = $this->headersOf($response);
		$this->assertSame('private, max-age=31536000, immutable', $headers['Cache-Control']);
		$this->assertSame('image/webp', $headers['Content-Type']);
	}

	// spec: IMAGES-001.2
	public function testAStaleVersionGetsTheCurrentImageWithoutKeepingIt(): void {
		$response = $this->controller([7 => $this->image()])->show(7, 256, self::MTIME - 1);

		$this->assertSame(Http::STATUS_OK, $response->getStatus());
		$this->assertSame('7-' . self::MTIME . '-256', $response->getETag());
		$this->assertSame('private, no-cache', $this->headersOf($response)['Cache-Control']);
	}

	// spec: IMAGES-001.3
	public function testAMatchingETagIsNotModifiedAndRendersNothing(): void {
		$preview = $this->createMock(IPreview::class);
		$preview->expects($this->never())->method('getPreview');

		$response = $this->controller([7 => $this->image()], $preview, ifNoneMatch: '"7-' . self::MTIME . '-4096"')->show(7, 4096, self::MTIME);

		$this->assertSame(Http::STATUS_NOT_MODIFIED, $response->getStatus());
		$this->assertSame('7-' . self::MTIME . '-4096', $response->getETag());
		$this->assertSame('private, max-age=31536000, immutable', $this->headersOf($response)['Cache-Control']);
	}

	// spec: IMAGES-001.3
	public function testAnOutdatedETagGetsTheImage(): void {
		$response = $this->controller([7 => $this->image()], ifNoneMatch: '"7-' . (self::MTIME - 1) . '-1024"')->show(7, 1024, self::MTIME);

		$this->assertSame(Http::STATUS_OK, $response->getStatus());
	}

	/** @return array<string, array{int}> */
	public static function sizesThatAreNoTier(): array {
		return ['between tiers' => [300], 'above the largest' => [16384], 'an old tier' => [512], 'negative' => [-256]];
	}

	// spec: IMAGES-001.5
	#[DataProvider('sizesThatAreNoTier')]
	public function testASizeThatIsNoTierIsABadRequest(int $size): void {
		$this->assertSame(Http::STATUS_BAD_REQUEST, $this->controller([7 => $this->image()])->show(7, $size, self::MTIME)->getStatus());
	}

	// spec: IMAGES-001.4
	public function testServesTheFullImageAsTierZero(): void {
		$preview = $this->createMock(IPreview::class);
		$preview->expects($this->never())->method('getPreview');

		$response = $this->controller([7 => $this->image()], $preview)->show(7, ImageService::FULL, self::MTIME);

		$this->assertSame(Http::STATUS_OK, $response->getStatus());
		$this->assertSame('7-' . self::MTIME . '-0', $response->getETag());
		$this->assertSame('image/jpeg', $this->headersOf($response)['Content-Type']);
	}

	// spec: IMAGES-001.5
	public function testAMissingSizeIsABadRequest(): void {
		$this->assertSame(Http::STATUS_BAD_REQUEST, $this->controller([7 => $this->image()])->show(7, v: self::MTIME)->getStatus());
	}

	// spec: IMAGES-001.8
	public function testAMissingImageIsNotFound(): void {
		$this->assertSame(Http::STATUS_NOT_FOUND, $this->controller([])->show(7, 1024, self::MTIME)->getStatus());
	}

	// spec: IMAGES-001.8
	public function testAnUnreadableImageIsForbidden(): void {
		$this->assertSame(Http::STATUS_FORBIDDEN, $this->controller([7 => $this->image(false)])->show(7, 1024, self::MTIME)->getStatus());
	}

	// spec: IMAGES-001.7
	public function testAnImageWithoutAPreviewIsNotFound(): void {
		$preview = $this->createStub(IPreview::class);
		$preview->method('getPreview')->willThrowException(new NotFoundException());

		$this->assertSame(Http::STATUS_NOT_FOUND, $this->controller([7 => $this->image()], $preview)->show(7, 1024, self::MTIME)->getStatus());
	}

	// spec: IMAGES-001.8
	public function testWithoutAUserNoImageIsServed(): void {
		$this->assertSame(Http::STATUS_UNAUTHORIZED, $this->controller([7 => $this->image()], loggedIn: false)->show(7, 1024, self::MTIME)->getStatus());
	}

	// spec: IMAGES-001.10
	public function testRendersTheTiersOfTheGivenFilesBeforeItAnswers(): void {
		$preview = $this->createMock(IPreview::class);
		$preview->expects($this->once())->method('generatePreviews')->with($this->isInstanceOf(File::class));

		$response = $this->controller([7 => $this->image()], $preview)->warm([7]);

		$this->assertSame(Http::STATUS_OK, $response->getStatus());
	}

	/** @return array<string, array{array<mixed>}> */
	public static function invalidFileIds(): array {
		return [
			'a string' => [[1, '2']],
			'zero' => [[0]],
			'negative' => [[-1]],
			'not a list' => [['a' => 1]],
			'above the files of one request' => [range(1, ImageService::WARM_LIMIT + 1)],
		];
	}

	/** @param array<mixed> $fileIds */
	// spec: IMAGES-001.11
	#[DataProvider('invalidFileIds')]
	public function testInvalidFileIdsAreABadRequestAndRenderNothing(array $fileIds): void {
		$preview = $this->createMock(IPreview::class);
		$preview->expects($this->never())->method('generatePreviews');

		$this->assertSame(Http::STATUS_BAD_REQUEST, $this->controller([], $preview)->warm($fileIds)->getStatus());
	}

	// spec: IMAGES-001.11
	public function testWithoutAUserNothingIsRendered(): void {
		$preview = $this->createMock(IPreview::class);
		$preview->expects($this->never())->method('generatePreviews');

		$this->assertSame(Http::STATUS_UNAUTHORIZED, $this->controller([], $preview, loggedIn: false)->warm([1])->getStatus());
	}

	// spec: IMAGES-001.8
	public function testShowIsAGetRouteForEveryUserThatAnImgCanLoadWithoutAToken(): void {
		$method = new \ReflectionMethod(ImageController::class, 'show');

		$routes = $method->getAttributes(FrontpageRoute::class);
		$this->assertCount(1, $routes);
		$this->assertSame(['verb' => 'GET', 'url' => '/api/v1/images/{fileId}', 'requirements' => ['fileId' => '\d+']], $routes[0]->getArguments());
		$this->assertCount(1, $method->getAttributes(NoAdminRequired::class));
		$this->assertCount(1, $method->getAttributes(NoCSRFRequired::class));
	}

	// spec: IMAGES-001.10
	public function testWarmIsAPostRouteForEveryUserWithTheCsrfCheck(): void {
		$method = new \ReflectionMethod(ImageController::class, 'warm');

		$routes = $method->getAttributes(FrontpageRoute::class);
		$this->assertCount(1, $routes);
		$this->assertSame(['verb' => 'POST', 'url' => '/api/v1/previews'], $routes[0]->getArguments());
		$this->assertCount(1, $method->getAttributes(NoAdminRequired::class));
		$this->assertCount(0, $method->getAttributes(NoCSRFRequired::class));
	}
}
