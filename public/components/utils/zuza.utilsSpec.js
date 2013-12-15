describe('zuza.utils', function() {
    'use strict';

    beforeEach(module('zuza.utils'));

    describe('zuzaBytes formatter', function() {

    	it('should format bytes to string', inject(function($filter) {
            var zuzaBytes = $filter('zuzaBytes');

            expect(zuzaBytes(0)).to.be('0 bytes');
            expect(zuzaBytes(10)).to.be('10 bytes');
            expect(zuzaBytes(999)).to.be('999 bytes');
            expect(zuzaBytes(1024)).to.be('1.0 kB');
            expect(zuzaBytes(999 * 1024)).to.be('999.0 kB');
            expect(zuzaBytes(1024 * 1024)).to.be('1.0 MB');
            expect(zuzaBytes(999 * 1024 * 1024)).to.be('999.0 MB');
            expect(zuzaBytes(1024 * 1024 * 1024)).to.be('1.0 GB');
            expect(zuzaBytes(999 * 1024 * 1024 * 1024)).to.be('999.0 GB');
        }));
    });

    describe('zuzaAttr directive', function() {

        it('should set attribute value to model and track model changes', inject(function($compile, $rootScope) {
            var scope = $rootScope.$new();
            scope.vb = 'hello';

            var elm = $compile('<span zuza-attr="viewBox=vb"></span>')(scope);

            expect(elm[0].getAttribute('viewBox')).to.be('hello');


            scope.$apply(function() {
                scope.vb = 'goodbye';
            });
            expect(elm[0].getAttribute('viewBox')).to.be('goodbye');
        }));

        it('should remove attribute when model is undefined', inject(function($compile, $rootScope) {
            var elm = $compile('<span zuza-attr="viewBox=vb"></span>')($rootScope);

            expect(elm[0].getAttribute('viewBox')).to.be(null);

            $rootScope.vb = 'goodbye';
            $rootScope.$digest();
            expect(elm[0].getAttribute('viewBox')).to.be('goodbye');

            delete $rootScope['vb'];
            $rootScope.$digest();
            expect(elm[0].getAttribute('viewBox')).to.be(null);

            $rootScope.vb = 'astalavista';
            $rootScope.$digest();
            expect(elm[0].getAttribute('viewBox')).to.be('astalavista');

            $rootScope.vb = null;
            $rootScope.$digest();
            expect(elm[0].getAttribute('viewBox')).to.be(null);
        }));
    });
});