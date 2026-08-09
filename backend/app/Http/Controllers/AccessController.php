<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AccessController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $ids = DB::table('purchases')->where('user_id', $request->user()->id)->where('status', 'paid')->pluck('chapter_id')->values();

        return response()->json(['chapterIds' => $ids]);
    }
}
