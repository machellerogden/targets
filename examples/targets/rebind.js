'use strict';
// rebind example on a composite target
// try invoking invoke with: ./examples/mycli --logger.location Seattle rebind
module.exports = [ '@logger.location::weather.location', 'weather' ];