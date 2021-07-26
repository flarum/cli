<?php

namespace <%= classNamespace %>;

use Flarum\Database\AbstractModel;
use Flarum\Database\ScopeVisibilityTrait;
use Flarum\Foundation\EventGeneratorTrait;

class <%= className %> extends AbstractModel
{
    // See https://docs.flarum.org/extend/models.html#backend-models for more information.
    <% if (tableName) { %>
    protected $table = '<%= tableName %>';<% } %>
}
