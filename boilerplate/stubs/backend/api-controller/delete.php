<?php

namespace <%= classNamespace %>;

use Flarum\Api\Controller\AbstractDeleteController;
use Flarum\Http\RequestUtil;<% if (typeof handlerClass !== 'undefined' && handlerClass) { %>
use Illuminate\Contracts\Bus\Dispatcher;<% } %>
use Illuminate\Support\Arr;
use Psr\Http\Message\ServerRequestInterface;<% if (typeof handlerClass !== 'undefined' && handlerClass) { %>
use <%= handlerClass %>;<% } %>
use <%= serializerClass %>;

class <%= className %> extends AbstractDeleteController
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
    protected function delete(ServerRequestInterface $request)
    {
        $modelId = Arr::get($request->getQueryParams(), 'id');
        $actor = RequestUtil::getActor($request);
        $input = $request->getParsedBody();
        <% if (typeof handlerClassName !== 'undefined' && handlerClassName) { %>
        $this->bus->dispatch(
            new <%= handlerClassName %>($modelId, $actor, $input)
        );
        <% } else { %>
        // ...
        <% } %>
    }
}
