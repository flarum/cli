<?php

namespace <%= classNamespace %>;
<% if (classType !== 'none') { %>
use Flarum\Api\Controller\<%= classType %>;<% } %>
use Flarum\Http\RequestUtil;<% if (classType !== 'AbstractShowController' && classType !== 'AbstractListController') { %>
use Illuminate\Contracts\Bus\Dispatcher;<% } %><% if (classType === 'AbstractShowController' || classType === 'AbstractDeleteController') { %>
use Illuminate\Support\Arr;<% } %><% if (classType === 'none') { %>
use Psr\Http\Message\ResponseInterface;<% } %>
use Psr\Http\Message\ServerRequestInterface;<% if (classType === 'none') { %>
use Psr\Http\Server\RequestHandlerInterface;<% } %><% if (classType !== 'none' && classType !== 'AbstractDeleteController') { %>
use Tobscure\JsonApi\Document;<% } %>
<% if (classType === 'none') { %>
class <%= className %> implements RequestHandlerInterface<% } %><% if (classType !== 'none') { %>
class <%= className %> extends <%= classType %><% } %>
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
    <% } %><% if (classType === 'AbstractShowController' || classType === 'AbstractListController' || classType === 'AbstractCreateController') { %>
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
    <% } %><% if (classType === 'none') { %>
    /**
     * {@inheritdoc}
     */
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        // ...
    }<% } %>
}
