<?php

namespace <%= classNamespace %>;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\SerializesModels;

class <%= className %> implements ShouldQueue
{
    use Queueable;
    use SerializesModels;

    public function __construct()
    {
        // ...
    }

    public function handle()
    {
        // See https://laravel.com/docs/8.x/queues for more information.
    }
}
