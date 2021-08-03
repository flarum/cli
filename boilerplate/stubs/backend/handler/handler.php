<?php

namespace <%= classNamespace %>;

use Illuminate\Support\Arr;<% if (locals.repositoryClassName) { %>
use <%= repositoryClass %>;<% } %><% if (locals.validatorClassName) { %>
use <%= validatorClass %>;<% } %>
<% const dependencies = [locals.repositoryClassName && [repositoryClassName, 'repository'] || null, locals.validatorClassName && [validatorClassName, 'validator'] || null].filter(item => item !== null) %>
class <%= className %>
{<% if (locals.repositoryClassName) { %>
    /**
     * @var <%= repositoryClassName %>
     */
    protected $repository;
<% } %><% if (locals.validatorClassName) { %>
    /**
     * @var <%= validatorClassName %>
     */
    protected $validator;
<% } %>
    public function __construct(<%= dependencies.map(item => `${item[0]} $${item[1]}`).join(', ') %>)
    {
        <%- dependencies.map(item => `$this->${item[1]} = $${item[1]};`).join("\n\t\t") %>
    }

    public function handle(<%= handlerCommandClassName %> $command)
    {
        $actor = $command->actor;
        $data = $command->data;

        $actor->assertCan('...');

        // ...

        return $model;
    }
}
