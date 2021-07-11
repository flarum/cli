<?php

namespace <%= classNamespace %>;

use <%= eventClass %>;

class <%= className %>
{
    public function handle(<%= eventClassName %> $event)
    {
        // Add logic to handle the event here.
        // See https://docs.flarum.org/extend/backend-events.html for more information.
    }
}
