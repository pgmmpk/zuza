(function(angular) {
	
	var module = angular.module('zuza.tree', []);
	
	module.directive('zuzaDateTree', function() {
		
		return {
			restrict: 'E',
			scope: {
				tree: '=',
				activated: '&'
			},
			template: '<ul class="tree">' +
						'<li ng-repeat="f in tree.children">' +
							'<div class="tree-node active-cursor" ng-click="f.expanded = !f.expanded">' +
								'<i class="fa" ng-class="{\'fa-caret-down\': f.expanded, \'fa-caret-right\': !f.expanded}"></i>' +
									'{{f.name}}' +
							'</div>' +
							'<ul class="tree" ng-show="f.expanded">' +
								'<li ng-repeat="x in f.children">' +
									'<div class="tree-node active-cursor" ng-click="x.expanded = !x.expanded">' +
										'<i class="fa" ng-class="{\'fa-caret-down\': x.expanded, \'fa-caret-right\': !x.expanded}"></i>' +
										'{{"month-" + x.name | translate}}' +
									'</div>' +
									'<ul class="tree" ng-show="x.expanded">' +
										'<li class="active-cursor" ng-repeat="y in x.children" ng-click="onClicked(y)">' +
											'<span ng-class="{\'selected\': y.selected}">{{y.name}}</span>' +
											'<i class="numfiles">({{y.files ? y.files.length : y.size}})</i>' +
										'</li>' +
									'</ul>' +
								'</li>' +
							'</ul>' +
						'</li>' +
					'</ul>',
			
			link: function(scope, elm, attr) {
				scope.onClicked = function(node) {
					scope.activated({'node': node});
				};
			}
		};
	});
	
})(angular);