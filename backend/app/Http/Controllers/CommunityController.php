<?php

namespace App\Http\Controllers;

use App\Models\CommunityPost;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CommunityController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $posts = CommunityPost::with('author:id,name,role,xp')->where('status', 'open')->latest()->paginate((int) min(50, max(1, $request->integer('perPage', 20))));

        return response()->json($posts);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate(['category' => ['required', 'string', 'max:80'], 'title' => ['required', 'string', 'max:180'], 'body' => ['required', 'string', 'max:10000'], 'tags' => ['nullable', 'array']]);
        $post = $request->user()->communityPosts()->create($data);

        return response()->json(['post' => $post->load('author:id,name,role,xp')], 201);
    }

    public function show(CommunityPost $post): JsonResponse
    {
        return response()->json(['post' => $post->load('author:id,name,role,xp')]);
    }
}
