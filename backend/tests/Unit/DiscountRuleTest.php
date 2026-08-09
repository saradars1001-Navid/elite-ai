<?php

namespace Tests\Unit;

use App\Models\DiscountRule;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * The performance-discount tiers (>=90 → 30%, >=80 → 20%, >=70 → 10%) must be
 * exact at every boundary: 69 gets nothing, 70 and 79 get 10%, 80 and 89 get
 * 20%, 90 and above get 30%.
 */
class DiscountRuleTest extends TestCase
{
    #[DataProvider('boundaryScores')]
    public function test_percent_for_maps_boundary_scores_to_tiers(int $score, int $expected): void
    {
        $rule = (new DiscountRule)->forceFill([
            'high_min' => 90, 'high_percent' => 30,
            'mid_min' => 80, 'mid_percent' => 20,
            'low_min' => 70, 'low_percent' => 10,
        ]);

        $this->assertSame($expected, $rule->percentFor($score));
    }

    public static function boundaryScores(): array
    {
        return [
            'صفر' => [0, 0],
            'زیر پایین‌ترین tier (۶۹)' => [69, 0],
            'کف tier پایین (۷۰)' => [70, 10],
            'سقف tier پایین (۷۹)' => [79, 10],
            'کف tier متوسط (۸۰)' => [80, 20],
            'سقف tier متوسط (۸۹)' => [89, 20],
            'کف tier بالا (۹۰)' => [90, 30],
            'نمره کامل (۱۰۰)' => [100, 30],
        ];
    }
}
