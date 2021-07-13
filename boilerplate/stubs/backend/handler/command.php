<?php

namespace <%= classNamespace %>;

use Flarum\User\User;

class <%= className %>
{<% if (!['create', 'none'].includes(classType)) { %>
    /**
     * @var int
     */
    public $modelId;
<% } %>
    /**
     * @var \Flarum\User\User
     */
    public $actor;

    /**
     * @var array
     */
    public $data;

    public function __construct(<%= !['create', 'none'].includes(classType) ? '$modelId, ' : '' %>User $actor, array $data)
    {<% if (!['create', 'none'].includes(classType)) { %>
        $this->modelId = $modelId;<% } %>
        $this->actor = $actor;
        $this->data = $data;
    }
}
