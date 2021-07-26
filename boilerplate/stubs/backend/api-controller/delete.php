<?php

namespace <%= classNamespace %>;

use Flarum\Api\Controller\AbstractDeleteController;
use Flarum\Http\RequestUtil;<% if (typeof handlerCommandClass !== 'undefined' && handlerCommandClass) { %>
use Illuminate\Contracts\Bus\Dispatcher;<% } %>
use Illuminate\Support\Arr;
use Psr\Http\Message\ServerRequestInterface;<% if (typeof handlerCommandClass !== 'undefined' && handlerCommandClass) { %>
use <%= handlerCommandClass %>;<% } %>
use <%= serializerClass %>;

class <%= className %> extends AbstractDeleteController
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
    protected function delete(ServerRequestInterface $request)
    {
        // See https://docs.flarum.org/extend/api.html#api-endpoints for more information.

        $modelId = Arr::get($request->getQueryParams(), 'id');
        $actor = RequestUtil::getActor($request);
        $input = $request->getParsedBody();
        <% if (typeof handlerCommandClassName !== 'undefined' && handlerCommandClassName) { %>
        $this->bus->dispatch(
            new <%= handlerCommandClassName %>($modelId, $actor, $input)
        );
        <% } else { %>
        // ...
        <% } %>
    }
}
