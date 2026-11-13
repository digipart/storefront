<?php

// LOCAL DEVELOPMENT ONLY. Answers what `api/storefront/<path>` of a Digipart installed on THIS machine would answer, by running its own code from the command line: the site engine then shows the
// real, current state of the local shop (drafts of a preview link included) without a front key. Usage: php bridge.php <root of the Digipart application> <path: '' | design.php | page.php |
// lookbook.php | story.php | products.php | shipping.php> <the query as JSON>. Prints the JSON answer, or `null` for what the API answers 404. Never used when DIGIPART_URL and a key are set; never to be deployed.
if (PHP_SAPI !== 'cli' || $argc < 4) {
    exit(1);
}
chdir($argv[1]);
ob_start();
require 'conf/config.php';
ob_end_clean();

use Digipart\Storefront\StorefrontAdmin;
use Digipart\Storefront\StorefrontApi;
use Digipart\Storefront\StorefrontThemes;

$query = json_decode($argv[3], true) ?: [];
$text = static fn (string $name): string => is_scalar($query[$name] ?? null) ? trim((string) $query[$name]) : '';
$idMarketPlace = (int) $text('IdMarketPlace');
$language = preg_match('/^[A-Za-z]{2,3}\z/', $text('LanguageIsoCode')) === 1 ? strtolower($text('LanguageIsoCode')) : null;
$theme = $text('PreviewToken') !== '' ? StorefrontThemes::previewTheme($text('PreviewToken'), $idMarketPlace, defined('SECRET_KEY') ? (string) SECRET_KEY : '') : null;
$preview = $theme !== null;
$api = new StorefrontApi(new StorefrontAdmin($pdo));
$answer = match ($argv[2]) {
    '' => $api->site($idMarketPlace, $language, $preview, (int) $theme, filter_var($text('IP'), FILTER_VALIDATE_IP) !== false ? $text('IP') : null),
    'design.php' => $api->design($idMarketPlace, $text('Key'), $language, $preview, (int) $theme),
    'page.php' => $text('Slug') !== '' ? $api->page($idMarketPlace, $text('Slug'), $language, $preview) : (($pages = $api->pages($idMarketPlace, $language, $preview)) === null ? null : ['Pages' => $pages]),
    'lookbook.php' => $text('Slug') !== '' ? $api->lookbook($idMarketPlace, $text('Slug'), $language, $preview) : (($books = $api->lookbooks($idMarketPlace, $language, $preview)) === null ? null : ['Lookbooks' => $books]),
    'story.php' => ($stories = $api->stories($idMarketPlace, $text('Placement'), (int) $text('IdProduct'), $language, $preview)) === null ? null : ['Stories' => $stories],
    'products.php' => $text('Mode') === 'paths' ? (($paths = $api->productPaths($idMarketPlace, (int) $text('IdProduct'))) === null ? null : ['Paths' => (object) $paths]) : ($text('Mode') === 'slug' ? (($found = $api->productIdBySlug($idMarketPlace, $text('Slug'))) === null ? null : ['ProductIds' => $found > 0 ? [$found] : []]) : (function () use ($api, $idMarketPlace, $text) { $ids = $api->productIds($idMarketPlace, in_array($text('Mode'), ['category', 'manual'], true) ? $text('Mode') : 'latest', (int) $text('IdCategory'), $text('ProductIds') === '' ? [] : explode(',', $text('ProductIds')), (int) ($text('Limit') ?: 12)); return $ids === null ? null : ['ProductIds' => $ids]; })()),
    'shipping.php' => $api->freeShipping($idMarketPlace, $text('CountryIsoCode')),
    'search.php' => $api->search($idMarketPlace, $text('Term'), $language, (int) ($text('Limit') ?: 24), (int) $text('Offset')),
    'version.php' => $api->version($idMarketPlace),
    'payment.php' => $api->payment($idMarketPlace),
    'paypal-notify.php' => (require __DIR__ . '/paypal-notify.php')($pdo, $text('IdCapture'), (int) $text('IdCart'), (string) ($rootUrl ?? '')),   // local development only: see that file
    'stripe-notify.php' => (require __DIR__ . '/stripe-notify.php')($pdo, $text('ClientSecret'), (string) ($rootUrl ?? '')),   // local development only: see that file
    'sitemap.php' => $api->sitemap($idMarketPlace, in_array($text('Type'), ['product', 'category', 'page'], true) ? $text('Type') : null, $language, max(1, (int) $text('Page'))),
    default => null,
};
echo json_encode($answer, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
