<?php

namespace <%= classNamespace %>;

use Flarum\Api\Controller\AbstractCreateController;
use Flarum\Http\RequestUtil;<% if (typeof handlerCommandClass !== 'undefined' && handlerCommandClass) { %>
use Illuminate\Contracts\Bus\Dispatcher;<% } %>
use Illuminate\Support\Arr;
use Psr\Http\Message\ServerRequestInterface;
use Tobscure\JsonApi\Document;<% if (typeof handlerCommandClass !== 'undefined' && handlerCommandClass) { %>
use <%= handlerCommandClass %>;<% } %>
use <%= serializerClass %>;

class <%= className %> extends AbstractCreateController
{
    /**
     * {@inheritdoc}
     */
    public $serializer = <%= serializerClassName %>::class;
<% if (typeof handlerCommandClassName !== 'undefined' && handlerCommandClassName) { %>
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

<% } %>
    /**
     * {@inheritdoc}
     */
    protected function data(ServerRequestInterface $request, Document $document)
    {
        // See https://docs.flarum.org/extend/api.html#api-endpoints for more information.

        $actor = RequestUtil::getActor($request);
        $data = Arr::get($request->getParsedBody(), 'data', []);
        <% if (typeof handlerCommandClassName !== 'undefined' && handlerCommandClassName) { %>
        $model = $this->bus->dispatch(
            new <%= handlerCommandClassName %>($actor, $data)
        );
        <% } else { %>
        // $model = ...
        <% } %>
        return $model;
    }
}
