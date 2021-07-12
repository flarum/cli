<?php

namespace <%= classNamespace %>;

use Flarum\Api\Controller\AbstractSerializeController;
use Psr\Http\Message\ServerRequestInterface;
use Tobscure\JsonApi\Collection;
use Tobscure\JsonApi\Resource;
use Tobscure\JsonApi\SerializerInterface;

class <%= className %> extends AbstractSerializeController
{
    /**
     * {@inheritdoc}
     */
    protected function createElement($data, SerializerInterface $serializer)
    {
        // return new Collection($data, $serializer);
        // return new Resource($data, $serializer);
    }
}
