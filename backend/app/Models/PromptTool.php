<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PromptTool extends Model
{
    protected $fillable = ['id', 'name', 'emoji', 'category', 'description', 'style'];

    public $incrementing = false;

    protected $keyType = 'string';
}
