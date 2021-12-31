import { prompt, prompts } from 'prompts';
import { create as createStore, Store } from 'mem-fs';
import { create } from 'mem-fs-editor';
import { resolve } from 'path';
import { PromptsIO, promptsIOFactory } from 'boilersmith/io';
import { NodePaths, Paths } from 'boilersmith/paths';
import { currParamValues, getParamName, promptParamValues, TemplateParam } from 'boilersmith/scaffolding/template-param';

describe('Template Param Utils', function() {
    const templateParams: TemplateParam[] = [
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
            compute: async(_path: Paths, param1: string, param2: number) => param1.slice(0, param2)
        }
    ];

    it('currParamValues works', async function() {
        expect(await currParamValues(templateParams, createStore(), new NodePaths({package: resolve(__dirname, '../fixtures')}), new PromptsIO({}))).toStrictEqual({
            param1: `Hello world!\n\n<%= requiredMessage %>`,
            param2: 8,
            param3: 'Hello wo'
        })
    });


    it('currParamValues falls back to prompt if not available', async function() {
        const params: TemplateParam[] = [...templateParams, {
            prompt: {name: 'param4', type: 'text', message: 'Param 4'},
            getCurrVal: async () => undefined
        }]

        prompt.inject(['param4Val']);


        expect(await currParamValues(params, createStore(), new NodePaths({package: resolve(__dirname, '../fixtures')}), new PromptsIO({}))).toStrictEqual({
            param1: `Hello world!\n\n<%= requiredMessage %>`,
            param2: 8,
            param3: 'Hello wo',
            param4: 'param4Val'
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