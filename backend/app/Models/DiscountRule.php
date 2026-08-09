<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DiscountRule extends Model
{
    protected $fillable = ['name', 'high_min', 'high_percent', 'mid_min', 'mid_percent', 'low_min', 'low_percent'];

    protected function casts(): array
    {
        return ['high_min' => 'integer', 'high_percent' => 'integer', 'mid_min' => 'integer', 'mid_percent' => 'integer', 'low_min' => 'integer', 'low_percent' => 'integer'];
    }

    /** Map a 0-100 exam score to a next-chapter discount percent (0 if below the lowest tier). */
    public function percentFor(int $score): int
    {
        if ($score >= $this->high_min) {
            return $this->high_percent;
        }
        if ($score >= $this->mid_min) {
            return $this->mid_percent;
        }
        if ($score >= $this->low_min) {
            return $this->low_percent;
        }

        return 0;
    }
}
