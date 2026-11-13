<?php

// LOCAL DEVELOPMENT ONLY (required by dev/bridge.php). On a real site Stripe itself tells Digipart a payment succeeded (its webhook to api/payment/stripe/ipn.php) and Digipart makes the order.
// Stripe cannot reach a Digipart installed on a developer's machine, so this stands in for that one call: it asks Stripe (with the TEST key kept in Digipart) whether the payment really
// succeeded, and only then hands Digipart the notification Stripe would have sent. It refuses anything but the test mode, and a cart that already has its order. Never to be deployed.
return static function (\PDO $pdo, string $clientSecret, string $rootUrl): array {
    if (preg_match('/^(pi_[A-Za-z0-9]+)_secret_[A-Za-z0-9]+\z/', $clientSecret, $found) !== 1) {
        return ['Status' => 'unknown'];
    }
    $provider = $pdo->query("SELECT `TestMode` FROM `PaymentProvider` WHERE `PaymentProviderName` = 'Stripe'")->fetch(\PDO::FETCH_ASSOC);
    if (!$provider || (int) $provider['TestMode'] !== 1) {
        return ['Status' => 'not-test-mode'];
    }
    $saved = $pdo->prepare('SELECT `MetadataJson` FROM `StripePayment` WHERE `ClientSecret` = :secret ORDER BY `IdStripePayment` DESC LIMIT 1');
    $saved->execute([':secret' => $clientSecret]);
    $data = json_decode((string) $saved->fetchColumn(), true);
    $idCart = (int) ($data['IdCart'] ?? 0);
    if ($idCart <= 0) {
        return ['Status' => 'unknown'];
    }
    $cart = $pdo->prepare('SELECT `CartPaymentState`, `IdOrder` FROM `Cart` WHERE `IdCart` = :id');
    $cart->execute([':id' => $idCart]);
    $state = $cart->fetch(\PDO::FETCH_ASSOC) ?: [];
    if ((int) ($state['CartPaymentState'] ?? 0) >= 2 || !empty($state['IdOrder'])) {
        return ['Status' => 'done'];
    }
    $key = $pdo->query("SELECT `SettingValue` FROM `Setting` WHERE `SettingKey` = 'stripeSecretTest'")->fetchColumn();
    $secretKey = (string) (new \Digipart\Security())->decrypt($key === false ? '' : (string) $key, SECRET_KEY);
    if (!str_starts_with($secretKey, 'sk_test_')) {
        return ['Status' => 'no-test-key'];
    }
    try {
        $intent = (new \Stripe\StripeClient($secretKey))->paymentIntents->retrieve($found[1]);
    } catch (\Throwable) {
        return ['Status' => 'stripe-error'];
    }
    if ($intent->status !== 'succeeded' || $intent->livemode) {
        return ['Status' => (string) $intent->status];
    }
    $event = json_encode(['id' => 'evt_local_' . $found[1], 'object' => 'event', 'type' => 'payment_intent.succeeded', 'livemode' => false, 'data' => ['object' => $intent->toArray()]]);
    $call = curl_init(rtrim($rootUrl, '/') . '/api/payment/stripe/ipn.php');
    curl_setopt_array($call, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $event, CURLOPT_HTTPHEADER => ['Content-Type: application/json'], CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 60,
        CURLOPT_SSL_VERIFYPEER => false, CURLOPT_SSL_VERIFYHOST => 0]);   // the certificate of a local Digipart is self-signed
    $body = curl_exec($call);
    $http = (int) curl_getinfo($call, CURLINFO_HTTP_CODE);
    curl_close($call);
    $cart->execute([':id' => $idCart]);
    $state = $cart->fetch(\PDO::FETCH_ASSOC) ?: [];

    return ['Status' => !empty($state['IdOrder']) ? 'done' : 'failed', 'Http' => $http, 'Answer' => $http >= 400 || empty($state['IdOrder']) ? substr(trim(strip_tags((string) $body)), 0, 6000) : ''];
};
