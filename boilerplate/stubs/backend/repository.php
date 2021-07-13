<?php

namespace <%= classNamespace %>;

use Flarum\User\User;
use Illuminate\Database\Eloquent\Builder;
use <%= modelClass %>;

class <%= className %>
{
    /**
     * @return Builder
     */
    public function query()
    {
        return <%= modelClassName %>::query();
    }

    /**
     * @param int $id
     * @param User $actor
     * @return <%= modelClassName %>
     */
    public function findOrFail($id, User $actor = null): <%= modelClassName %>
    {
        return <%= modelClassName %>::findOrFail($id);
    }
}
