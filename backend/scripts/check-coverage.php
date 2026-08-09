<?php

declare(strict_types=1);

/**
 * Enforces a minimum code-coverage percentage from a PHPUnit clover report.
 *
 * Usage:
 *   php scripts/check-coverage.php <clover.xml> [threshold]
 *
 * Exit codes:
 *   0 — coverage meets the threshold (PASS)
 *   1 — coverage is below the threshold (FAIL — build should stop)
 *   2 — usage or parse error (report missing/invalid)
 */
$file = $argv[1] ?? null;
$threshold = (float) ($argv[2] ?? '80');

if ($file === null || $file === '') {
    fwrite(STDERR, "Usage: php scripts/check-coverage.php <clover.xml> [threshold]\n");
    exit(2);
}

if (! is_file($file) || ! is_readable($file)) {
    fwrite(STDERR, "Coverage report not found: {$file}\n");
    exit(2);
}

$xml = @simplexml_load_file($file);
if ($xml === false || ! isset($xml->project)) {
    fwrite(STDERR, "Invalid clover report (no <project> element): {$file}\n");
    exit(2);
}

$metrics = $xml->project->metrics;
$statements = (int) $metrics['statements'];
$covered = (int) $metrics['coveredstatements'];
$percentage = $statements > 0 ? ($covered / $statements) * 100.0 : 0.0;

// Per-file breakdown, worst first, for actionable CI output.
$files = [];
foreach ($xml->project->file as $fileNode) {
    $fm = $fileNode->metrics;
    $fileStatements = (int) $fm['statements'];
    $fileCovered = (int) $fm['coveredstatements'];
    $files[] = [
        'name' => (string) $fileNode['name'],
        'statements' => $fileStatements,
        'covered' => $fileCovered,
        'percent' => $fileStatements > 0 ? ($fileCovered / $fileStatements) * 100.0 : 100.0,
    ];
}
usort($files, static fn (array $a, array $b): int => $a['percent'] <=> $b['percent']);

$passed = $percentage >= $threshold;

printf("Overall line coverage: %.2f%% (%d/%d statements)\n", $percentage, $covered, $statements);
printf("Required threshold:    %.2f%% → %s\n\n", $threshold, $passed ? 'PASS' : 'FAIL');

echo "Lowest-coverage files (top 10):\n";
if ($files === []) {
    echo "  (no files measured — check the <source> include in phpunit.xml)\n";
}
foreach (array_slice($files, 0, 10) as $f) {
    printf("  %6.2f%%  %4d/%-4d  %s\n", $f['percent'], $f['covered'], $f['statements'], $f['name']);
}

exit($passed ? 0 : 1);
