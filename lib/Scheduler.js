'use strict';

module.exports = Scheduler;

const Executor = require('./Executor');

const { hasOpFlag } = require('./predicates');
const { printUnit, print } = require('./util');
const { inDebugMode } = require('./predicates');
const { DEBUG_TOGGLE:DEBUG, PARALLEL_FLAG } = require('./constants');
const { inspect } = require('util');
const tty = require('./tty');
const { getLatest:getLatestConfig } = require('./store/Config');
const SystemStore = require('./store/System');

const PackageResult = unit => value => ({
    silent: !!unit.fn.silent,
    label: unit.fn.label || unit.name,
    value,
    stream: !!(value||{}).__stream__
});

const maybePrint = unit => {
    const { stream = false, fn = {} } = unit;
    return stream || hasOpFlag(fn) || printUnit(unit);
};

const Pretty = v => {
    if (typeof v !== 'object' || v == null) return `${v}`;
    return Object.entries(v)
        .reduce((acc, [ key, value ]) => {
            if (typeof value !== 'function') return acc;
            acc[key] = value.toString();
            return Object.entries(value)
                .reduce((a, [ k, v ]) => (a[`${key}.${k}`] = Pretty(v), a), acc);
        }, {});
};

const maybeDebug = (unit = {}) => {
    const { name } = unit;
    if (inDebugMode(name)) {
        print(DEBUG, `Scheduling '${name}' as:`);
        print(DEBUG, inspect(Pretty(unit), { depth: null, colors: true }));
        print(DEBUG, `Current config is:`);
        print(DEBUG, inspect(getLatestConfig(), { depth: null, colors: true }));
    }
};

const dashboardTty = (name, msg, tag) => {
    const { dashboard } = tty();
    dashboard.addLine(`${name} - {${tag}}${msg}{/${tag}}`);
    dashboard.scroll(1);
};

const dashboardMode = {
    tty: dashboardTty,
    ci: () => {},
    dev: () => {}
};

const DashboardUpdate = () => dashboardMode[SystemStore.get('mode')];

const QueueNames = (queue) => {
    if (queue.name) return queue.name;
    return queue.reduce((acc, u) => {
        if (Array.isArray(u)) {
            if (u[PARALLEL_FLAG]) return [ ...acc, QueueNames(u) ];
            return [ ...acc, ...QueueNames(u) ];
        }
        return [ ...acc, u.name ];
    }, []);
};

const QueueReport = (names) => {
    if (typeof names === 'string') return names;
    if (Array.isArray(names)) {
        return names.reduce((acc, v) => {
            if (Array.isArray(v)) return `${acc}[${QueueReport(v).slice(0, -1).replace(new RegExp( "\\n", "g" ), ',')}]\n`;
            return `${acc}${v}\n`;
        }, '');
    }
};

const queueReportMode = {
    tty: (queue) => tty().queueReport.setContent(QueueReport(QueueNames(queue))),
    ci: () => {},
    dev: () => {}
};

const QueueReportUpdate = () => queueReportMode[SystemStore.get('mode')];

function UnitOfWork(unit = {}) {
    if (Array.isArray(unit)) {
        if (unit[PARALLEL_FLAG]) return Promise.all(unit.map(UnitOfWork));
        return unit
            .map((u) => () => UnitOfWork(u))
            .reduce((c, fn) => c.then(acc => fn().then(value => [ ...acc, value ])), Promise.resolve([]));
    } else {
        maybeDebug(unit);
        if (typeof unit.fn === 'function') {
            DashboardUpdate()(unit.name, 'started', 'yellow-fg');
            return Executor(unit)
                .then((r) => (DashboardUpdate()(unit.name, 'done', 'green-fg'),r))
                .then(PackageResult(unit))
                .then(maybePrint);
        }
    }
}

async function* Scheduler(name, queue) {
    QueueReportUpdate()(queue);
    while (queue.length > 0) {
        try {
            yield UnitOfWork(queue.shift());
        } catch (e) {
            console.error('Caught promise rejection. Exiting now.', e);
            process.exit(1);
        }
    }
}