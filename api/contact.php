<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
function respond(int $code, string $message): void {
    http_response_code($code);
    echo json_encode(['message' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') respond(405, 'Bitte das Kontaktformular verwenden.');
if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 20000) respond(413, 'Die Anfrage ist zu lang.');
$config = require __DIR__ . '/config.php';
if (!$config['enabled']) respond(503, 'Der Formularversand wird gerade eingerichtet. Bitte schreibt uns an info@prometheus-feuershow.de.');
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && !in_array($origin, ['https://www.prometheus-feuershow.de', 'https://prometheus-feuershow.de'], true)) respond(403, 'Bitte das Formular auf unserer Website verwenden.');
function field(string $key, int $max): string {
    $value = $_POST[$key] ?? '';
    if (!is_string($value) || strlen($value) > $max) respond(422, 'Bitte die Eingaben prüfen und gegebenenfalls kürzen.');
    return trim(str_replace("\0", '', $value));
}
if (field('website', 500) !== '') respond(422, 'Die Anfrage konnte nicht verarbeitet werden.');
$name = field('name', 480);
$email = field('email', 180);
$phone = field('telefon', 240);
$kind = field('art', 80);
$other = field('andere_art', 640);
$place = field('ort', 1000);
$date = field('datum', 20);
$guests = field('besucher', 40);
$message = field('nachricht', 15000);
if (!$name || !$phone || !$place || !filter_var($email, FILTER_VALIDATE_EMAIL) || preg_match('/[\r\n]/', $email)) respond(422, 'Bitte Name, gültige E-Mail-Adresse, Telefonnummer und Veranstaltungsort angeben.');
if (!in_array($kind, ['Geburtstag', 'Hochzeit', 'Firmenfeier', 'Sonstiges'], true) || ($kind === 'Sonstiges' && $other === '')) respond(422, 'Bitte die Veranstaltungsart angeben.');
if (!in_array($guests, ['', '10-50', '50-100', '100-200', '200+'], true)) respond(422, 'Bitte die Besucherzahl prüfen.');
$parsed = DateTimeImmutable::createFromFormat('!Y-m-d', $date);
if (!$parsed || $parsed->format('Y-m-d') !== $date) respond(422, 'Bitte ein gültiges Veranstaltungsdatum angeben.');
// Ein atomarer Sperrdatensatz pro IP verhindert parallele Mehrfachsendungen.
// Im temporären Verzeichnis, niemals im öffentlich erreichbaren Webordner.
$scope = substr(hash('sha256', __DIR__), 0, 12);
$prefix = sys_get_temp_dir() . '/prometheus-contact-' . $scope . '-';
$gate = fopen(sys_get_temp_dir() . '/prometheus-contact-' . $scope . '.lock', 'c+');
if (!$gate || !flock($gate, LOCK_EX)) respond(503, 'Der Versand ist vorübergehend nicht verfügbar. Bitte kontaktiert uns per E-Mail.');
// Alte Sperrdatensätze entfernen, ohne eine gerade verwendete Datei zu löschen.
foreach (glob($prefix . '*') ?: [] as $stale) {
    if (!is_file($stale) || filemtime($stale) >= time() - 86400) continue;
    $staleLock = @fopen($stale, 'r+');
    if ($staleLock && flock($staleLock, LOCK_EX | LOCK_NB)) {
        if (fstat($staleLock)['mtime'] < time() - 86400) {
            // Windows erlaubt das Löschen erst nach dem Schließen des Handles.
            flock($staleLock, LOCK_UN); fclose($staleLock); @unlink($stale);
        } else { flock($staleLock, LOCK_UN); fclose($staleLock); }
    } elseif ($staleLock) { fclose($staleLock); }
}
$key = hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? 'unknown') . __DIR__);
$path = $prefix . $key;
$lock = fopen($path, 'c+');
if (!$lock) { flock($gate, LOCK_UN); fclose($gate); respond(503, 'Der Versand ist vorübergehend nicht verfügbar. Bitte kontaktiert uns per E-Mail.'); }
if (!flock($lock, LOCK_EX | LOCK_NB)) { fclose($lock); flock($gate, LOCK_UN); fclose($gate); respond(429, 'Eine Anfrage wird bereits bearbeitet. Bitte wartet kurz.'); }
flock($gate, LOCK_UN); fclose($gate);
$last = (int) stream_get_contents($lock);
if ($last && time() - $last < 120) { fclose($lock); respond(429, 'Bitte wartet zwei Minuten vor einer weiteren Anfrage.'); }
ftruncate($lock, 0); rewind($lock); fwrite($lock, (string)time()); fflush($lock);
$body = "Neue Showanfrage\n\nName: $name\nE-Mail: $email\nTelefon: $phone\nVeranstaltung: $kind\nAndere Veranstaltungsart: $other\nOrt: $place\nDatum: $date\nBesucher: $guests\n\nSonstiges:\n$message\n";
$headers = ['From' => $config['sender'], 'Reply-To' => $email, 'MIME-Version' => '1.0', 'Content-Type' => 'text/plain; charset=UTF-8'];
try {
    $ok = function_exists('mail') && @mail($config['recipient'], 'Neue Showanfrage - Prometheus', $body, $headers);
} catch (Throwable $error) {
    $ok = false;
    error_log('Prometheus: E-Mail-Versand fehlgeschlagen.');
}
flock($lock, LOCK_UN); fclose($lock);
if (!$ok) respond(503, 'Die Anfrage konnte nicht versendet werden. Eure Eingaben bleiben erhalten. Bitte schreibt an info@prometheus-feuershow.de.');
respond(200, 'Danke! Eure Anfrage wurde zum Versand angenommen. Wir melden uns bei euch.');
