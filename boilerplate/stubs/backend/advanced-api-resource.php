<?php

namespace <%= classNamespace %>;

use Flarum\Api\Context;
use Flarum\Api\Endpoint;
use Flarum\Api\Resource;
use Flarum\Api\Schema;<% if (modelClassName) { %>
use Flarum\Api\Sort\SortColumn;
use <%= modelClass %>;
use Illuminate\Database\Eloquent\Builder;<% } %>
use Tobyz\JsonApiServer\Context as OriginalContext;

/**
 * @extends <% if (modelClassName) { %>Resource\AbstractDatabaseResource<<%= modelClassName %>><% } else { %>Resource\AbstractResource<object><% } %>
 */
class <%= className %> extends <% if (modelClassName) { %>Resource\AbstractDatabaseResource<% } else { %>Resource\AbstractResource<% if (interfaces.length > 0) { %> implements <%= interfaces.join(', ') %><% } %><% } %>
{
    public function type(): string
    {
        return '<%= modelType %>';
    }<% if (modelClassName) { %>

    public function model(): string
    {
        return <%= modelClassName %>::class;
    }

    public function scope(Builder $query, OriginalContext $context): void
    {
        $query->whereVisibleTo($context->getActor());
    }<% } %>

    public function endpoints(): array
    {
        return [<% if (endpoints.includes('create')) { %>
            Endpoint\Create::make()<% if (modelClassName) { %>
                ->can('create<%= modelClassName %>')<% } %>,<% } %><% if (endpoints.includes('update')) { %>
            Endpoint\Update::make()
                ->can('update'),<% } %><% if (endpoints.includes('delete')) { %>
            Endpoint\Delete::make()
                ->can('delete'),<% } %><% if (endpoints.includes('show')) { %>
            Endpoint\Show::make()
                ->authenticated(),<% } %><% if (endpoints.includes('list')) { %>
            Endpoint\Index::make()
                ->paginate(),<% } %>
        ];
    }

    public function fields(): array
    {
        return [

            /**
             * @TODO migrate logic from old serializer and controllers to this API Resource.
             * @see https://docs.flarum.org/2.x/extend/api#api-resources
             */

            // Example:
            Schema\Str::make('name')
                ->requiredOnCreate()
                ->minLength(3)
                ->maxLength(255)
                ->writable(),

<% (relations || []).forEach(([name,type]) => { %>
            Schema\Relationship\<% if (type === 'hasOne') { %>ToOne<% } else { %>ToMany<% } %>::make('<%= name %>')
                ->includable()
                // ->inverse('?') // the inverse relationship name if any.
                ->type('<%= name %>s'), // the serialized type of this relation (type of the relation model's API resource).<% }) %>
        ];
    }<% if (modelClassName) { %>

    public function sorts(): array
    {
        return [
            // SortColumn::make('createdAt'),
        ];
    }<% } else { %>

    public function getId(object $model, OriginalContext $context): string
    {
        return $model->id;
    }<% } %>
}
