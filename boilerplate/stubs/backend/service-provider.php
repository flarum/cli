<?php

namespace <%= classNamespace %>;

use Illuminate\Contracts\Container\Container;

class <%= className %>
{
    public function register()
    {
        // $this->container->...
    }

    public function boot(Container $container)
    {
        // ...
    }
}
