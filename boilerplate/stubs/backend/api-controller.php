<?php

namespace <%= classNamespace %>;

use Flarum\Api\Controller\<%= classType %>;
use Flarum\Http\RequestUtil;<% if (classType === 'AbstractDeleteController' || classType === 'AbstractCreateController') { %>
use Illuminate\Contracts\Bus\Dispatcher;<% } %><% if (classType === 'AbstractShowController' || classType === 'AbstractDeleteController') { %>
use Illuminate\Support\Arr;<% } %>
use Psr\Http\Message\ServerRequestInterface;<% if (classType !== 'AbstractDeleteController') { %>
use Tobscure\JsonApi\Document;<% } %><% if (classType === 'AbstractSerializeController') { %>
use Tobscure\JsonApi\Collection;
use Tobscure\JsonApi\Resource;
use Tobscure\JsonApi\SerializerInterface;<% } %>

class <%= className %> extends <%= classType %>
{<% if (classType === 'AbstractCreateController' || classType === 'AbstractDeleteController') { %>
    /**
     * @var Dispatcher
     */
    protected $bus;

    /**
     * @param Dispatcher $bus
     */
    public function __construct(Dispatcher $bus)
    {
        $this->bus = $bus;
    }
    <% } %><% if (classType === 'AbstractSerializeController' || classType === 'AbstractShowController' || classType === 'AbstractListController' || classType === 'AbstractCreateController') { %>
    /**
     * {@inheritdoc}
     */
    protected function data(ServerRequestInterface $request, Document $document)
    {
        $actor = RequestUtil::getActor($request);
        <% if (classType === 'AbstractCreateController') { %>
        $model = $this->bus->dispatch(
            // ...
        );

        return $model;<% } %><% if (classType === 'AbstractShowController') { %>
        $modelId = Arr::get($request->getQueryParams(), 'id');

        $model = /* Query the model */;

        return $model;<% } %><% if (classType === 'AbstractListController') { %>
        $results = /* Query models */;

        return $results;<% } %>
    }
    <% } %><% if (classType === 'AbstractDeleteController') { %>
    /**
     * {@inheritdoc}
     */
    protected function delete(ServerRequestInterface $request)
    {
        $modelId = Arr::get($request->getQueryParams(), 'id');
        $actor = RequestUtil::getActor($request);
        $input = $request->getParsedBody();

        $this->bus->dispatch(
            // ...
        );
    }
    <% } %><% if (classType === 'AbstractSerializeController') { %>
    /**
     * {@inheritdoc}
     */
    protected function createElement($data, SerializerInterface $serializer)
    {
        // return new Collection($data, $serializer);
        // return new Resource($data, $serializer);
    }<% } %>
}
