<?php

namespace <%= classNamespace %>;

use Flarum\Database\AbstractModel;
use Flarum\Database\ScopeVisibilityTrait;
use Flarum\Foundation\EventGeneratorTrait;

class <%= className %> extends AbstractModel
{
    <% if (tableName) { %>protected $table = '<%= tableName %>';<% } %>
}
