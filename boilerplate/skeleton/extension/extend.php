<?php

/*
 * This file is part of <%= params.packageName %>.
 *
 * Copyright (c) <%= params.year %> <%= params.authorName %>.
 *
 * For the full copyright and license information, please view the LICENSE.md
 * file that was distributed with this source code.
 */

namespace <%= params.packageNamespace %>;

use Flarum\Extend;

return [
    <% if (modules.forum) { %>(new Extend\Frontend('forum'))
        <% if (modules.js) { %>->js(__DIR__.'/js/dist/forum.js')<% if (!modules.css) { %>,<% } %><% } %>
        <% if (modules.css) { %>->css(__DIR__.'/less/forum.less'),<% } %><% } %>
    <% if (modules.admin) { %>(new Extend\Frontend('admin'))
        <% if (modules.js) { %>->js(__DIR__.'/js/dist/admin.js')<% if (!modules.css) { %>,<% } %><% } %>
        <% if (modules.css) { %>->css(__DIR__.'/less/admin.less'),<% } %><% } %>
    <% if (modules.locale) { %>new Extend\Locales(__DIR__.'/locale'),<% } %>
];
