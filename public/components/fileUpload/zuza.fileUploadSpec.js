describe('zuza.fileUpload', function() {
	'use strict';

	describe('zuzaFileInput directive', function() {
		var rootScope = null, compile = null;

		beforeEach(function() {
			module('zuza.fileUpload');
			
			inject(function($rootScope, $compile) {
				rootScope = $rootScope;
				compile = $compile;
			});
		});

		function compileFileInput(markup, scope) {
			var el = compile(markup)(scope);
			scope.$digest();
			return el;
		}

		it('should generate hidden input(type="file") element', function() {
			
			var scope = rootScope.$new();
			scope.files= [];

			var fileInput = compileFileInput('<div><button zuza-file-input files="files">Browse</button></div>', scope);
			var input = fileInput.find('input');

			expect(input.attr('type')).to.be('file');
			expect(input.attr('multiple')).to.be('multiple');
			expect(input.attr('style')).to.be('visibility:hidden');
		});

		it('should call onChange() handler when finished', function(done) {
			var scope = rootScope.$new();
			scope.files= [];
			scope.onChange = function() {
				done();
			};

			var fileInput = compileFileInput('<div><button zuza-file-input files="files" on-change="onChange(files)">Browse</button></div>', scope);
			var input = fileInput.find('input');
			input.trigger('change');
		});
	});
	
});