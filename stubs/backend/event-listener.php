<?php

namespace <%= namespace %>;

use <%= eventClassFullyQualified %>;

class <%= className %>
{
  public function handle(<%= eventClassShort %> $event)
  {
    // Add logic to handle the event here.
    // See https://docs.flarum.org/extend/backend-events.html for more information.
  }
}
