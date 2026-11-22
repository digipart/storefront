<?php

// LOCAL MAMP ONLY: hands every request of the sub-domain to the Node server of the site engine (127.0.0.1:3100) and gives its answer back. Apache's own proxy is switched off in MAMP; this keeps its
// configuration untouched. Not for production (a real server proxies directly, and the engine is outside the document root).
$target = 'http://127.0.0.1:3100' . ($_SERVER['REQUEST_URI'] ?? '/');
$headers = ['X-Forwarded-Host: ' . ($_SERVER['HTTP_HOST'] ?? ''), 'X-Forwarded-Proto: ' . (!empty($_SERVER['HTTPS']) ? 'https' : 'http'), 'X-Forwarded-For: ' . ($_SERVER['REMOTE_ADDR'] ?? '')];
foreach (['HTTP_ACCEPT' => 'Accept', 'HTTP_ACCEPT_LANGUAGE' => 'Accept-Language', 'HTTP_COOKIE' => 'Cookie', 'HTTP_USER_AGENT' => 'User-Agent', 'CONTENT_TYPE' => 'Content-Type', 'HTTP_IF_NONE_MATCH' => 'If-None-Match', 'HTTP_ORIGIN' => 'Origin', 'HTTP_SEC_FETCH_SITE' => 'Sec-Fetch-Site', 'HTTP_ACCEPT_ENCODING' => 'Accept-Encoding'] as $key => $name) {
    if (isset($_SERVER[$key]) && $_SERVER[$key] !== '') {
        $headers[] = $name . ': ' . $_SERVER[$key];
    }
}
$curl = curl_init($target);
curl_setopt_array($curl, [CURLOPT_CUSTOMREQUEST => $_SERVER['REQUEST_METHOD'] ?? 'GET', CURLOPT_HTTPHEADER => $headers, CURLOPT_RETURNTRANSFER => true, CURLOPT_HEADER => true, CURLOPT_FOLLOWLOCATION => false, CURLOPT_CONNECTTIMEOUT => 2, CURLOPT_TIMEOUT => 30]);
if (!in_array($_SERVER['REQUEST_METHOD'] ?? 'GET', ['GET', 'HEAD'], true)) {
    curl_setopt($curl, CURLOPT_POSTFIELDS, (string) file_get_contents('php://input'));
}
$answer = curl_exec($curl);
if ($answer === false) {
    http_response_code(503);
    header('Content-Type: text/html; charset=utf-8');
    header('Retry-After: 10');
    echo '<!doctype html><meta charset="utf-8"><title>Site en cours de démarrage</title><body style="font-family:system-ui;max-width:560px;margin:15vh auto;padding:0 24px;color:#1e2129"><h1 style="font-size:22px">Le moteur du site n\'est pas démarré</h1><p>Lancez-le dans le dossier du site, puis rechargez cette page.</p></body>';
    exit;
}
$size = curl_getinfo($curl, CURLINFO_HEADER_SIZE);
http_response_code((int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE));
foreach (explode("\r\n", substr($answer, 0, $size)) as $line) {
    if (preg_match('/^(content-type|content-encoding|cache-control|etag|location|set-cookie|vary|last-modified|x-robots-tag|link|referrer-policy|server-timing):/i', $line) === 1) {
        header($line, false);
    }
}
echo substr($answer, $size);
