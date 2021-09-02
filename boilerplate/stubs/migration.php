<?php

use Illuminate\Database\Schema\Blueprint;
<% if (typeof tableName === 'undefined' || ! tableName) { %>
use Illuminate\Database\Schema\Builder;

// HINT: you might want to use a `Flarum\Database\Migration` helper method for simplicity!
// See https://docs.flarum.org/extend/models.html#migrations to learn more about migrations.
return [
    'up' => function (Builder $schema) {
        // up migration
    },
    'down' => function (Builder $schema) {
        // down migration
    }
];<% } %><% if (typeof tableName !== 'undefined' && tableName) { %>
use Flarum\Database\Migration;

return Migration::createTable(
    '<%= tableName %>',
    function (Blueprint $table) {
        $table->increments('id');

        // created_at & updated_at
        $table->timestamps();
    }
);
<% } %>
