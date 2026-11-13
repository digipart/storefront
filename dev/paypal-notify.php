<?php

// LOCAL DEVELOPMENT ONLY (required by dev/bridge.php). On a real site PayPal itself tells Digipart a payment was taken (its webhook to api/payment/paypal/ipn.php) and Digipart makes the
// order. PayPal cannot reach a Digipart installed on a developer's machine, so this stands in for that one call, in test mode only: it hands Digipart the notification PayPal would have sent
// for a capture. Digipart then checks that capture with PayPal itself (class/PaypalCheckout.php): a capture that does not exist, or is not the one of the cart, makes no order.
// Never to be deployed.
return static function (\PDO $pdo, string $idCapture, int $idCart, string $rootUrl): array {
    $paypal = \Digipart\PaypalCheckout::live($pdo);
    if ($paypal === null || !$paypal->canVerify() || !$paypal->testMode()) {
        return ['Status' => 'not-test-mode'];
    }
    if (!\Digipart\PaypalCheckout::isId($idCapture) || $idCart <= 0) {
        return ['Status' => 'unknown'];
    }
    $cart = $pdo->prepare('SELECT `CartPaymentState`, `IdOrder` FROM `Cart` WHERE `IdCart` = :id');
    $cart->execute([':id' => $idCart]);
    $state = $cart->fetch(\PDO::FETCH_ASSOC) ?: [];
    if ((int) ($state['CartPaymentState'] ?? 0) >= 2 || !empty($state['IdOrder'])) {
        return ['Status' => 'done'];
    }
    $event = json_encode(['id' => 'WH-LOCAL-' . $idCapture, 'event_type' => 'PAYMENT.CAPTURE.COMPLETED', 'summary' => 'Payment completed (local stand-in)', 'status' => 'COMPLETED',
        'resource' => ['id' => $idCapture, 'custom_id' => (string) $idCart, 'status' => 'COMPLETED', 'purchase_units' => [['amount' => ['currency_code' => 'EUR']]]]]);
    $call = curl_init(rtrim($rootUrl, '/') . '/api/payment/paypal/ipn.php');
    curl_setopt_array($call, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $event, CURLOPT_HTTPHEADER => ['Content-Type: application/json'], CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 60,
        CURLOPT_SSL_VERIFYPEER => false, CURLOPT_SSL_VERIFYHOST => 0]);   // the certificate of a local Digipart is self-signed
    $body = curl_exec($call);
    $http = (int) curl_getinfo($call, CURLINFO_HTTP_CODE);
    curl_close($call);
    $cart->execute([':id' => $idCart]);
    $state = $cart->fetch(\PDO::FETCH_ASSOC) ?: [];

    return ['Status' => !empty($state['IdOrder']) ? 'done' : 'failed', 'Http' => $http, 'Answer' => $http >= 400 || empty($state['IdOrder']) ? substr(trim(strip_tags((string) $body)), 0, 2000) : ''];
};
