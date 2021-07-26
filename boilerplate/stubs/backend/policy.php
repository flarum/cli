<?php

namespace <%= classNamespace %>;

use <%= modelClass %>;
use Flarum\User\Access\AbstractPolicy;
use Flarum\User\User;

class <%= className %> extends AbstractPolicy
{
    public function can(User $actor, string $ability, <%= modelClassName %> $model)
    {
        // See https://docs.flarum.org/extend/authorization.html#custom-policies for more information.
    }
}
