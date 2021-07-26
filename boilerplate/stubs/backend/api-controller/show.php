<?php

namespace <%= classNamespace %>;

use Flarum\Api\Controller\AbstractShowController;
use Flarum\Http\RequestUtil;
use Illuminate\Support\Arr;
use Psr\Http\Message\ServerRequestInterface;
use Tobscure\JsonApi\Document;<% if (typeof repositoryClass !== 'undefined' && repositoryClass) { %>
use <%= repositoryClass %>;<% } %>
use <%= serializerClass %>;

class <%= className %> extends AbstractShowController
{
    /**
     * {@inheritdoc}
     */
    public $serializer = <%= serializerClassName %>::class;
<% if (typeof repositoryClassName !== 'undefined' && repositoryClassName) { %>
    /**
     * @var <%= repositoryClassName %>
     */
    protected $repository;

    /**
     * @param <%= repositoryClassName %> $repository
     */
    public function __construct(<%= repositoryClassName %> $repository)
    {
        $this->repository = $repository;
    }

<% } %>
    /**
     * {@inheritdoc}
     */
    protected function data(ServerRequestInterface $request, Document $document)
    {
        // See https://docs.flarum.org/extend/api.html#api-endpoints for more information.

        $actor = RequestUtil::getActor($request);
        $modelId = Arr::get($request->getQueryParams(), 'id');

        // $model = ...;

        return $model;
    }
}
