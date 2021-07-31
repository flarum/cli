<?php

namespace <%= classNamespace %>;

use Flarum\Api\Serializer\AbstractSerializer;
use <%= modelClass %>;
use InvalidArgumentException;

class <%= className %> extends AbstractSerializer
{
    /**
     * {@inheritdoc}
     */
    protected $type = '<%= modelType %>';

    /**
     * {@inheritdoc}
     *
     * @param <%= modelClassName %> $model
     * @throws InvalidArgumentException
     */
    protected function getDefaultAttributes($model)
    {
        if (! ($model instanceof <%= modelClassName %>)) {
            throw new InvalidArgumentException(
                get_class($this).' can only serialize instances of '.<%= modelClassName %>::class
            );
        }

        // See https://docs.flarum.org/extend/api.html#serializers for more information.

        return [
            // ...
        ];
    }
}
