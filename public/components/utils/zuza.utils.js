(function(angular) {

    var module = angular.module('zuza.utils', []);

    // From https://gist.github.com/thomseddon/3511330
    module.filter('zuzaBytes', function() {
        return function(bytes, precision) {
            if (isNaN(parseFloat(bytes)) || !isFinite(bytes) || bytes < 0) {
                return '-';
            }
            var units = ['bytes', 'kB', 'MB', 'GB', 'TB', 'PB'],
                number = (bytes === 0) ? 0 : Math.floor(Math.log(bytes) / Math.log(1024));
            if (number === 0) {
                // bytes: we do not want decimals here, regardless of precision
                return bytes + ' ' + units[number];
            } else {
                if (typeof precision === 'undefined') {
                    precision = 1;
                }

                return (bytes / Math.pow(1024, Math.floor(number))).toFixed(precision) +  ' ' + units[number];
            }
        };
    });

    /**
     * Watches model changes and sets element's attribute value accordingly.
     * Unlike ngAttr, attribute names are case-sensitive. This is important for
     * embedded XML, like svg's viewBox (lower-cased attribute will not be recognised).
     */
    module.directive('zuzaAttr', function() {
        return {
            restrict: 'A',
            scope: false,
            link: function(scope, elm, attr) {
                var m = attr.zuzaAttr.match(/^\s*([^=]+)\s*=\s*(\S+)\s*$/);
                if (!m[2]) {
                    throw new Error('bad syntax, use "attrName=model"');
                }
                var attrName = m[1], model = m[2];

                function updateAttribute() {
                    if ( scope[model] === 'undefined' || scope[model] == null) {
                        elm[0].removeAttribute(attrName);
                    } else {
                        elm[0].setAttribute(attrName, scope[model]);
                    }
                }
                scope.$watch(function() { return scope[model];}, function() {
                    updateAttribute();
                });
                updateAttribute();
            }
        };
    });

})(angular);