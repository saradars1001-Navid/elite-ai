<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProfileController extends Controller
{
    public function update(Request $request): JsonResponse
    {
        $data = $request->validate(['name' => ['required', 'string', 'min:3', 'max:120']]);
        $request->user()->update(['name' => trim($data['name'])]);

        return response()->json(['user' => $request->user()->fresh()]);
    }
}
