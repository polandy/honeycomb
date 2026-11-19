<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

/** @var array{script: string, admin: bool} $_ */
\OCP\Util::addScript('honeycomb', $_['script']);
?>
<div id="honeycomb" data-admin="<?php echo $_['admin'] ? 'true' : 'false'; ?>"></div>
