<?php

namespace <%= classNamespace %>;

use Flarum\Api\Controller\AbstractCreateController;
use Flarum\Http\RequestUtil;<% if (typeof handlerClass !== 'undefined' && handlerClass) { %>
use Illuminate\Contracts\Bus\Dispatcher;<% } %>
use Illuminate\Support\Arr;
use Psr\Http\Message\ServerRequestInterface;
use Tobscure\JsonApi\Document;<% if (typeof handlerClass !== 'undefined' && handlerClass) { %>
use <%= handlerClass %>;<% } %>
use <%= serializerClass %>;

class <%= className %> extends AbstractCreateController
{
    /**
     * {@inheritdoc}
     */
    public $serializer = <%= serializerClassName %>::class;
<% if (typeof handlerClassName !== 'undefined' && handlerClassName) { %>
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
        $actor = RequestUtil::getActor($request);
        $data = Arr::get($request->getParsedBody(), 'data', []);
        <% if (typeof handlerClassName !== 'undefined' && handlerClassName) { %>
        $model = $this->bus->dispatch(
            new <%= handlerClassName %>($actor, $data)
        );
        <% } else { %>
        // $model = ...
        <% } %>
        return $model;
    }
}
