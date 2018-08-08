/**
 * This software is released under the MIT license:
 *
 * Copyright 2018 Mac Heller-Ogden
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

'use strict';

module.exports = Targets;
Targets.load = require('./lib/load');
Targets.Spawn = require('./lib/Spawn');

const Answers = require('answers');
const Queue = require('./lib/Queue');
const InitialPrompt = require('./lib/InitialPrompt');
const Scheduler = require('./lib/Scheduler');
const Prompts = require('./lib/Prompts');
const builtinOps = require('./lib/operations');

const { push:pushConfig } = require('./lib/store/Config');
const { loadFromOptions:loadSettingsFromOptions } = require('./lib/store/Setting');

async function Targets(options = {}) {

    const {
        name = getName(),
        targets = {},
        operations:ops = {}, // here be dragons...
        argv = process.argv.slice(2)
    } = options;

    process.title = name;

    const args = await InitialPrompt({ targets, argv });
    const operations = { ...builtinOps, ...ops };
    const queue = Queue({ targets, operations, args });
    const prompts = Prompts(queue);
    const answers = Answers({ name, prompts });
    const config = await answers.get();

    pushConfig(config);
    loadSettingsFromOptions(config);

    /* eslint-disable-next-line */
    for await (const result of Scheduler(queue)) {}
}

function getName() {
    const { name = 'targets' } = require('read-pkg-up').sync({ cwd: require('path').dirname(require('parent-module')()) }).pkg || {};
    return name;
}
