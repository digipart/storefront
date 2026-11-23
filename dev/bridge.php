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
    // as api/storefront/design.php: the alternate design of ONE category (Key=catalog, IdCategory) or product (Key=product, IdProduct)
    'design.php' => $api->design($idMarketPlace, $text('Key'), $language, $preview, (int) $theme, $text('Key') === 'catalog' && (int) ($query['IdCategory'] ?? 0) > 0 ? 'category' : ($text('Key') === 'product' && (int) ($query['IdProduct'] ?? 0) > 0 ? 'product' : null), (int) ($query[$text('Key') === 'catalog' ? 'IdCategory' : 'IdProduct'] ?? 0)),
    'code.php' => $api->code($idMarketPlace, $text('Key'), $preview, (int) $theme),
    'page.php' => $text('Slug') !== '' ? $api->page($idMarketPlace, $text('Slug'), $language, $preview) : (($pages = $api->pages($idMarketPlace, $language, $preview)) === null ? null : ['Pages' => $pages]),
    'lookbook.php' => $text('Slug') !== '' ? $api->lookbook($idMarketPlace, $text('Slug'), $language, $preview) : (($books = $api->lookbooks($idMarketPlace, $language, $preview)) === null ? null : ['Lookbooks' => $books]),
    'story.php' => ($stories = $api->stories($idMarketPlace, $text('Placement'), (int) $text('IdProduct'), $language, $preview)) === null ? null : ['Stories' => $stories],
    'products.php' => in_array($text('Mode'), ['top_viewed', 'top_cart', 'top_sales'], true) ? (($ranked = $api->rankedProductIds($idMarketPlace, $text('Mode'), (int) ($text('Days') ?: 30), (int) ($text('Limit') ?: 12), (int) $text('IdCategory'))) === null ? null : ['ProductIds' => $ranked])
        : ($text('Mode') === 'personal' ? (($mine = $api->personalProductIds($idMarketPlace, (int) $text('IdCustomer'), (int) ($text('Limit') ?: 12))) === null ? null : ['ProductIds' => $mine]) : ($text('Mode') === 'category_all' ? (($all = $api->categoryProductIds($idMarketPlace, (int) $text('IdCategory'))) === null ? null : ['ProductIds' => $all]) : ($text('Mode') === 'paths' ? (($paths = $api->productPaths($idMarketPlace, (int) $text('IdProduct'))) === null ? null : ['Paths' => (object) $paths]) : ($text('Mode') === 'slug' ? (($found = $api->productIdBySlug($idMarketPlace, $text('Slug'))) === null ? null : ['ProductIds' => $found > 0 ? [$found] : []]) : (function () use ($api, $idMarketPlace, $text) { $ids = $api->productIds($idMarketPlace, in_array($text('Mode'), ['category', 'manual'], true) ? $text('Mode') : 'latest', (int) $text('IdCategory'), $text('ProductIds') === '' ? [] : explode(',', $text('ProductIds')), (int) ($text('Limit') ?: 12)); return $ids === null ? null : ['ProductIds' => $ids]; })())))),
    'shipping.php' => $api->freeShipping($idMarketPlace, $text('CountryIsoCode')),
    'search.php' => $text('Facets') === '1' ? $api->searchPanel($idMarketPlace, $text('Term'), $language, ['attributes' => preg_match('/^\d{1,9}(,\d{1,9}){0,39}$/', $text('Attributes')) === 1 ? array_map('intval', explode(',', $text('Attributes'))) : [],
        'min' => (int) $text('PriceMin'), 'max' => (int) $text('PriceMax'), 'tab' => (int) $text('Tab'), 'sort' => $text('Sort'), 'promo' => $text('Promo') === '1', 'limit' => (int) ($text('Limit') ?: 24), 'offset' => (int) $text('Offset')])
        : $api->search($idMarketPlace, $text('Term'), $language, (int) ($text('Limit') ?: 24), (int) $text('Offset')),
    'version.php' => $api->version($idMarketPlace),
    'countries.php' => $api->countries($idMarketPlace),
    'payment.php' => $api->payment($idMarketPlace),
    'category-stage.php' => $api->categoryStage($idMarketPlace, (int) $text('IdCategory')),
    'looks.php' => $api->looks($idMarketPlace, (int) $text('IdProduct')),
    'category-cover.php' => $api->categoryCover($idMarketPlace, (int) $text('IdCategory')),
    'brand.php' => $api->brands($idMarketPlace, $language, $text('Slug')),
    'product-video.php' => (int) $text('IdProduct') > 0 ? $api->productVideo($idMarketPlace, (int) $text('IdProduct')) : $api->coverVideos($idMarketPlace),
    'product-extra.php' => $api->productExtras($idMarketPlace, (int) $text('IdProduct'), (float) $text('Amount'), $language),
    'product-batch.php' => (function () use ($api, $idMarketPlace, $text) {   // as api/storefront/product-batch.php (no reserved category is checked here: development only)
        $ids = preg_match('/^\d{1,10}(,\d{1,10}){0,59}$/', $text('Ids')) === 1 ? array_values(array_unique(array_map('intval', explode(',', $text('Ids'))))) : [];
        $batch = $api->productBatch($idMarketPlace, $ids, $text('LanguageIsoCode') ?: 'FR', $text('CurrencyIsoCode') ?: 'EUR', $text('Fields') === 'card');
        $products = [];
        foreach ($ids as $id) { $products[(string) $id] = $batch['products'][$id] ?? null; }
        return ['Products' => (object) $products, 'Cached' => $batch['cached'], 'Failed' => $batch['failed']];
    })(),
    'paypal-notify.php' => (require __DIR__ . '/paypal-notify.php')($pdo, $text('IdCapture'), (int) $text('IdCart'), (string) ($rootUrl ?? '')),   // local development only: see that file
    'stripe-notify.php' => (require __DIR__ . '/stripe-notify.php')($pdo, $text('ClientSecret'), (string) ($rootUrl ?? '')),   // local development only: see that file
    'store-stock.php' => $api->storeStock($idMarketPlace, (int) $text('IdProduct'), $language),
    'changes.php' => (float) $text('Since') > 0 ? \Digipart\Storefront\StorefrontChanges::since((float) $text('Since')) : ['Now' => microtime(true), 'Products' => [], 'Complete' => true],
    'category-links.php' => $api->categoryLinks($idMarketPlace, (int) $text('IdCategory'), $language),
    'attribute-looks.php' => $api->attributeLooks($idMarketPlace, array_map('intval', explode(',', $text('Ids')))),
    'sitemap.php' => $api->sitemap($idMarketPlace, in_array($text('Type'), ['product', 'category', 'brand', 'page'], true) ? $text('Type') : null, $language, max(1, (int) $text('Page'))),
    default => null,
};
echo json_encode($answer, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
