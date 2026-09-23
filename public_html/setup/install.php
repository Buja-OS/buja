<?php
declare(strict_types=1);

/**
 * Buja setup: writes the two .htaccess files Apache needs on shared hosting (cPanel).
 *
 * Files whose names start with a dot are hidden by Windows and macOS, so they tend to be left out when folders
 * are dragged into GitHub or a file manager. This page recreates them from the visible templates beside it.
 * Open https://your-domain/setup/install.php once after uploading. Running it again is harmless.
 * On Render these files are not used (routing lives in the Dockerfile), so this page is only for cPanel.
 */
header('Content-Type: text/html; charset=utf-8');
header('X-Robots-Tag: noindex');

$root = dirname(__DIR__);
$jobs = [
    ['template' => __DIR__ . '/htaccess-root.txt', 'target' => $root . '/.htaccess', 'label' => 'public_html/.htaccess'],
    ['template' => __DIR__ . '/htaccess-api.txt',  'target' => $root . '/api/.htaccess', 'label' => 'public_html/api/.htaccess'],
];
$rows = [];
foreach ($jobs as $j) {
    if (!is_file($j['template'])) { $rows[] = [$j['label'], 'template missing', false]; continue; }
    $want = (string) file_get_contents($j['template']);
    $have = is_file($j['target']) ? (string) file_get_contents($j['target']) : null;
    if ($have === $want) { $rows[] = [$j['label'], 'already correct', true]; continue; }
    $ok = @file_put_contents($j['target'], $want) !== false;
    $rows[] = [$j['label'], $ok ? ($have === null ? 'created' : 'updated') : 'could not write: check the folder permissions (755)', $ok];
}
$all = !in_array(false, array_column($rows, 2), true);
?><!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Buja setup</title>
<style>body{font-family:system-ui,sans-serif;max-width:560px;margin:40px auto;padding:0 16px;color:#1B1B1F}h1{font-size:22px}
.row{display:flex;justify-content:space-between;gap:12px;padding:12px 14px;border:1px solid #E5E5DF;border-radius:12px;margin:8px 0}
.ok{color:#2E7D1E;font-weight:700}.bad{color:#D92D20;font-weight:700}.note{color:#6B6B73;font-size:14px;line-height:1.5}a{color:#FF7A1A}</style></head><body>
<h1><?= $all ? 'Buja is set up for this server' : 'Almost there' ?></h1>
<?php foreach ($rows as [$label, $msg, $ok]): ?><div class="row"><span><?= htmlspecialchars($label) ?></span><span class="<?= $ok ? 'ok' : 'bad' ?>"><?= htmlspecialchars($msg) ?></span></div><?php endforeach; ?>
<p class="note"><?= $all ? 'Both routing files are in place. Open <a href="/">your Buja site</a>, then <a href="/api/ping">/api/ping</a>: it should answer with {"ok":true}.' : 'Fix the item in red, then reload this page.' ?></p>
<p class="note">You can leave this page in place. It only ever writes these two files, with the exact content shipped beside it.</p>
</body></html>
