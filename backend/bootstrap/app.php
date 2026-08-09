<?php

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\HandleCors;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->api(prepend: [HandleCors::class]);
    })
    ->withSchedule(function (Schedule $schedule) {
        // Unread notifications older than 90 days are pruned every day at 03:00.
        $schedule->command('notifications:prune --days=90')->dailyAt('03:00')->withoutOverlapping();
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // JSON exception rendering is enabled by the API Accept header.
    })->create();
