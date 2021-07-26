<?php

namespace <%= classNamespace %>;

use Illuminate\Contracts\Container\Container;

class <%= className %>
{
    public function register()
    {
        // See https://docs.flarum.org/extend/service-provider.html#service-provider for more information.
    }

    public function boot(Container $container)
    {
        // ...
    }
}
