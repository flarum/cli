import { prompt } from 'prompts';
import { create as createStore, Store } from 'mem-fs';
import { create } from 'mem-fs-editor';
import { resolve } from 'path';
import { promptsIOFactory } from 'boilersmith/io';
import { NodePaths, Paths } from 'boilersmith/paths';
import { currParamValues, getParamName, promptParamValues, TemplateParam } from 'boilersmith/scaffolding/template-param';

describe('Template Param Utils', function() {
    const templateParams: TemplateParam<unknown>[] = [
        {
            prompt: {
                name: 'param1',
                type: 'text',
                message: 'Param 1'
            },
            getCurrVal: async (fs: Store, paths: Paths) => {
                const editor = create(fs);
                return editor.read(resolve(paths.package(), 'sample.tpl'))
            }
        },
        {
            prompt: {
                name: 'param2',
                type: 'text',
                message: 'Param 2'
            },
            getCurrVal: async () => 8
        },
        {
            name: 'param3',
            uses: ['param1', 'param2'],
            compute: (_path: Paths, param1: string, param2: number) => param1.slice(0, param2)
        }
    ];

    it('currParamValues works', async function() {
        expect(await currParamValues(templateParams, createStore(), new NodePaths({package: resolve(__dirname, '../fixtures')}))).toStrictEqual({
            param1: `Hello world!\n\n<%= requiredMessage %>`,
            param2: 8,
            param3: 'Hello wo'
        })
    });

    it('promptParamValues works', async function() {   
        prompt.inject(['Test', 3]);

        expect(await promptParamValues(templateParams, new NodePaths({package: ''}), promptsIOFactory({}))).toStrictEqual({
            param1: 'Test',
            param2: 3,
            param3: 'Tes'
        })
    });
});